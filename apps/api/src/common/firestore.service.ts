import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { PostgresService } from './postgres.service';

export class FirestoreDecimal {
  constructor(private readonly value: number) {}
  toNumber() { return this.value; }
  toString() { return String(this.value); }
  valueOf() { return this.value; }
  toJSON() { return this.value; }
}

const DECIMAL_FIELDS: Record<string, Set<string>> = {
  wallet: new Set(['depositBalance', 'winningsBalance', 'bonusBalance']),
  transaction: new Set(['amount', 'balanceAfter']),
  deposit: new Set(['amount']),
  withdrawal: new Set(['amount']),
  subscription: new Set(['amount']),
  subscriptionPayment: new Set(['amount']),
  contest: new Set(['entryFee', 'prizePoolTotal']),
  contestEntry: new Set(['entryFeePaid', 'totalPoints', 'prizeWon']),
  fantasyTeamPlayer: new Set(['creditsAtSelection', 'battingPoints', 'bowlingPoints', 'fieldingPoints', 'bonusPoints', 'powerupPoints', 'totalPoints']),
  playerFixtureCredit: new Set(['credits']),
};

const COLLECTIONS: Record<string, string> = {
  user: 'users',
  refreshToken: 'refreshTokens',
  authAuditLog: 'authAuditLogs',
  profile: 'profiles',
  kycRecord: 'kycRecords',
  wallet: 'wallets',
  transaction: 'transactions',
  deposit: 'deposits',
  withdrawal: 'withdrawals',
  subscription: 'subscriptions',
  subscriptionPayment: 'subscriptionPayments',
  scoringRuleSet: 'scoringRuleSets',
  contest: 'contests',
  contestEntry: 'contestEntries',
  fantasyTeam: 'fantasyTeams',
  fantasyTeamPlayer: 'fantasyTeamPlayers',
  fantasyTeamEditHistory: 'fantasyTeamEditHistory',
  leaderboardSnapshot: 'leaderboardSnapshots',
  playerFixtureCredit: 'playerFixtureCredits',
  cachedFixture: 'cachedFixtures',
  cachedPlayer: 'cachedPlayers',
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof FirestoreDecimal) && !(v as any).toDate;
}

function unwrap(value: unknown): unknown {
  if (value instanceof FirestoreDecimal) return value.toNumber();
  if (value instanceof Date) return value;
  if ((value as any)?.toDate && typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (Array.isArray(value)) return value.map(unwrap);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = unwrap(v);
    return out;
  }
  return value;
}

function reviveDates(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => reviveDates(v));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && key && /(?:At|Date|Time)$/.test(key) && !Number.isNaN(Date.parse(value))) return new Date(value);
    return value;
  }
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = reviveDates(v, k);
  return out;
}

function decorateRecord(model: string, data: Record<string, any>): Record<string, any> {
  const out = reviveDates(data) as Record<string, any>;
  for (const field of DECIMAL_FIELDS[model] ?? new Set<string>()) {
    if (out[field] !== null && out[field] !== undefined && !(out[field] instanceof FirestoreDecimal)) {
      out[field] = new FirestoreDecimal(Number(out[field]));
    }
  }
  return out;
}

function scalar(v: unknown): any {
  return v instanceof FirestoreDecimal ? v.toNumber() : v;
}

function whereMatches(record: Record<string, any>, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'AND' && Array.isArray(expected)) return expected.every((w) => whereMatches(record, w));
    if (field === 'OR' && Array.isArray(expected)) return expected.some((w) => whereMatches(record, w));
    const actual = scalar(record[field]);
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected) && !(expected instanceof FirestoreDecimal)) {
      if ('in' in expected) return (expected as any).in.includes(actual);
      if ('notIn' in expected) return !(expected as any).notIn.includes(actual);
      if ('lt' in expected) return actual < (expected as any).lt;
      if ('lte' in expected) return actual <= (expected as any).lte;
      if ('gt' in expected) return actual > (expected as any).gt;
      if ('gte' in expected) return actual >= (expected as any).gte;
      if ('equals' in expected) return actual === (expected as any).equals;
    }
    if (expected instanceof FirestoreDecimal) return Number(actual) === expected.toNumber();
    if (expected instanceof Date) return new Date(actual as any).getTime() === expected.getTime();
    return actual === expected;
  });
}

function sortRows(rows: any[], orderBy: any): any[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      const [field, direction] = Object.entries(spec)[0] as [string, string];
      const av = scalar(a[field]);
      const bv = scalar(b[field]);
      if (av === bv) continue;
      const cmp = av < bv ? -1 : 1;
      return direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

type Delegate = {
  findUnique: (args: any) => Promise<any>;
  findFirst: (args: any) => Promise<any>;
  findMany: (args?: any) => Promise<any[]>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  updateMany: (args: any) => Promise<{ count: number }>;
  deleteMany: (args: any) => Promise<{ count: number }>;
  count: (args?: any) => Promise<number>;
  aggregate: (args: any) => Promise<any>;
  upsert: (args: any) => Promise<any>;
};

type Filter = [string, string, any];

type DocumentSnapshotLike = {
  id: string;
  exists: boolean;
  data(): any;
  ref: DocumentRefLike;
};

type QuerySnapshotLike = {
  docs: DocumentSnapshotLike[];
  empty: boolean;
  size: number;
};

type DocumentRefLike = {
  id: string;
  get(): Promise<DocumentSnapshotLike>;
  set(data: any, options?: { merge?: boolean }): Promise<void>;
  update(data: any): Promise<void>;
  delete(): Promise<void>;
};

type QueryLike = {
  where(field: string, op: string, value: any): QueryLike;
  orderBy(field: string, direction?: 'asc' | 'desc'): QueryLike;
  limit(count: number): QueryLike;
  select(...fields: string[]): QueryLike;
  get(): Promise<QuerySnapshotLike>;
};

type CollectionLike = QueryLike & {
  doc(id: string): DocumentRefLike;
};

type TransactionLike = {
  get(target: DocumentRefLike | QueryLike): Promise<any>;
  set(ref: DocumentRefLike, data: any, options?: { merge?: boolean }): Promise<void> | void;
  update(ref: DocumentRefLike, data: any): Promise<void> | void;
  delete(ref: DocumentRefLike): Promise<void> | void;
  create(ref: DocumentRefLike, data: any): Promise<void> | void;
};

type BatchLike = {
  set(ref: DocumentRefLike, data: any, options?: { merge?: boolean }): BatchLike;
  update(ref: DocumentRefLike, data: any): BatchLike;
  delete(ref: DocumentRefLike): BatchLike;
  commit(): Promise<void>;
};

type DatabaseCompat = {
  collection(name: string): CollectionLike;
  batch(): BatchLike;
  runTransaction<T>(fn: (tx: TransactionLike) => Promise<T>): Promise<T>;
};

class SqlDocumentSnapshot implements DocumentSnapshotLike {
  constructor(
    public readonly id: string,
    private readonly value: any,
    public readonly ref: SqlDocumentRef,
  ) {}
  get exists() { return this.value !== null && this.value !== undefined; }
  data() { return this.exists ? this.value : undefined; }
}

class SqlQuerySnapshot {
  constructor(public readonly docs: SqlDocumentSnapshot[]) {}
  get empty() { return this.docs.length === 0; }
  get size() { return this.docs.length; }
}

class SqlDocumentRef implements DocumentRefLike {
  constructor(
    private readonly db: SqlPersistenceDb,
    public readonly collectionName: string,
    public readonly id: string,
  ) {}
  async get() { return this.db.getDoc(this.collectionName, this.id); }
  async set(data: any, options?: { merge?: boolean }) { await this.db.setDoc(this.collectionName, this.id, data, options?.merge !== false); }
  async update(data: any) { await this.db.updateDoc(this.collectionName, this.id, data); }
  async delete() { await this.db.deleteDoc(this.collectionName, this.id); }
}

class SqlQuery implements QueryLike {
  protected readonly filters: Filter[] = [];
  protected readonly ordering: Array<[string, 'asc' | 'desc']> = [];
  protected takeCount: number | undefined;
  protected selected: string[] | undefined;

  constructor(protected readonly db: SqlPersistenceDb, public readonly collectionName: string) {}

  where(field: string, op: string, value: any) {
    this.filters.push([field, op, scalar(value)]);
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    this.ordering.push([field, direction]);
    return this;
  }

  limit(count: number) {
    this.takeCount = Math.max(0, Math.trunc(count));
    return this;
  }

  select(...fields: string[]) {
    this.selected = fields;
    return this;
  }

  async get() {
    return this.db.queryDocs(this.collectionName, this.filters, this.ordering, this.takeCount, this.selected);
  }
}

class SqlCollectionRef extends SqlQuery implements CollectionLike {
  doc(id: string) { return new SqlDocumentRef(this.db, this.collectionName, String(id)); }
}

class SqlTransaction implements TransactionLike {
  constructor(private readonly db: SqlPersistenceDb) {}

  async get(target: SqlDocumentRef | SqlQuery) {
    if (target instanceof SqlDocumentRef) return this.db.getDoc(target.collectionName, target.id, true);
    return target.get();
  }

  set(ref: SqlDocumentRef, data: any, options?: { merge?: boolean }) {
    return ref.set(data, options);
  }

  update(ref: SqlDocumentRef, data: any) {
    return ref.update(data);
  }

  delete(ref: SqlDocumentRef) {
    return ref.delete();
  }

  create(ref: SqlDocumentRef, data: any) {
    return ref.set(data, { merge: false });
  }
}

class SqlBatch implements BatchLike {
  private readonly operations: Array<(tx: SqlTransaction) => Promise<void>> = [];

  constructor(private readonly db: SqlPersistenceDb) {}

  set(ref: SqlDocumentRef, data: any, options?: { merge?: boolean }) {
    this.operations.push((tx) => tx.set(ref, data, options));
    return this;
  }

  update(ref: SqlDocumentRef, data: any) {
    this.operations.push((tx) => tx.update(ref, data));
    return this;
  }

  delete(ref: SqlDocumentRef) {
    this.operations.push((tx) => tx.delete(ref));
    return this;
  }

  async commit() {
    if (!this.operations.length) return;
    await this.db.runTransaction(async (tx) => {
      for (const op of this.operations) await op(tx);
    });
  }
}

class SqlPersistenceDb implements DatabaseCompat {
  private readonly txContext = new AsyncLocalStorage<PoolClient>();

  constructor(private readonly pool: Pool) {}

  collection(name: string) { return new SqlCollectionRef(this, name); }
  batch() { return new SqlBatch(this); }

  private client() {
    return this.txContext.getStore() ?? this.pool;
  }

  private async query<T extends QueryResultRow = any>(sql: string, params: any[] = []) {
    return this.client().query<T>(sql, params);
  }

  async getDoc(collectionName: string, id: string, forUpdate = false) {
    const result = await this.query<{ id: string; data: any }>(
      'SELECT id, data FROM crickx_records WHERE collection_name = $1 AND id = $2' + (forUpdate ? ' FOR UPDATE' : ''),
      [collectionName, id],
    );
    const row = result.rows[0];
    const ref = new SqlDocumentRef(this, collectionName, id);
    return new SqlDocumentSnapshot(id, row ? decorateRecord(collectionName, { id, ...(row.data ?? {}) }) : null, ref);
  }

  async queryDocs(
    collectionName: string,
    filters: Filter[],
    ordering: Array<[string, 'asc' | 'desc']>,
    limit?: number,
    selected?: string[],
  ) {
    const result = await this.query<{ id: string; data: any }>(
      'SELECT id, data FROM crickx_records WHERE collection_name = $1',
      [collectionName],
    );

    let rows = result.rows.map((row) => decorateRecord(collectionName, { id: row.id, ...(row.data ?? {}) }));
    rows = rows.filter((row) => filters.every(([field, op, expected]) => {
      const actual = scalar(row[field]);
      if (op === '==') return actual === expected || (actual instanceof Date && expected instanceof Date && actual.getTime() === expected.getTime());
      if (op === '!=') return actual !== expected;
      if (op === '<') return actual < expected;
      if (op === '<=') return actual <= expected;
      if (op === '>') return actual > expected;
      if (op === '>=') return actual >= expected;
      if (op === 'in') return Array.isArray(expected) && expected.includes(actual);
      if (op === 'not-in') return Array.isArray(expected) && !expected.includes(actual);
      return false;
    }));
    rows = sortRows(rows, ordering.map(([field, direction]) => ({ [field]: direction })));
    if (limit !== undefined) rows = rows.slice(0, limit);

    const docs = rows.map((row) => {
      let data = { ...row };
      delete data.id;
      if (selected?.length) data = Object.fromEntries(selected.map((key) => [key, data[key]]).filter(([, value]) => value !== undefined));
      const ref = new SqlDocumentRef(this, collectionName, String(row.id));
      return new SqlDocumentSnapshot(String(row.id), data, ref);
    });

    return new SqlQuerySnapshot(docs);
  }

  async setDoc(collectionName: string, id: string, data: any, merge = true) {
    const clean = (unwrap(data) ?? {}) as Record<string, any>;
    if (!merge) {
      await this.query(
        'INSERT INTO crickx_records (collection_name, id, data, updated_at) VALUES ($1,$2,$3::jsonb,NOW()) ON CONFLICT (collection_name,id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()',
        [collectionName, id, JSON.stringify(clean)],
      );
      return;
    }

    const current = await this.getDoc(collectionName, id);
    const merged = current.exists ? { ...(current.data() as any), ...clean } : clean;
    await this.query(
      'INSERT INTO crickx_records (collection_name, id, data, updated_at) VALUES ($1,$2,$3::jsonb,NOW()) ON CONFLICT (collection_name,id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()',
      [collectionName, id, JSON.stringify(merged)],
    );
  }

  private applyPatch(base: any, patch: any) {
    const out = { ...base };
    for (const [key, value] of Object.entries(patch ?? {})) {
      if (value === undefined) continue;
      if (isPlainObject(value) && 'increment' in value) out[key] = Number(out[key] ?? 0) + Number((value as any).increment);
      else if (isPlainObject(value) && 'decrement' in value) out[key] = Number(out[key] ?? 0) - Number((value as any).decrement);
      else out[key] = unwrap(value);
    }
    if ('updatedAt' in out) out.updatedAt = new Date();
    return out;
  }

  async updateDoc(collectionName: string, id: string, patch: any) {
    const current = await this.getDoc(collectionName, id, Boolean(this.txContext.getStore()));
    if (!current.exists) throw new Error(collectionName + ' record not found: ' + id);
    const updated = this.applyPatch(current.data(), patch);
    await this.query(
      'UPDATE crickx_records SET data = $3::jsonb, updated_at = NOW() WHERE collection_name = $1 AND id = $2',
      [collectionName, id, JSON.stringify(updated)],
    );
  }

  async deleteDoc(collectionName: string, id: string) {
    await this.query('DELETE FROM crickx_records WHERE collection_name = $1 AND id = $2', [collectionName, id]);
  }

  async runTransaction<T>(fn: (tx: SqlTransaction) => Promise<T>): Promise<T> {
    const active = this.txContext.getStore();
    if (active) return fn(new SqlTransaction(this));
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.txContext.run(client, () => fn(new SqlTransaction(this)));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async transactionGet(collectionName: string, id: string) {
    const active = this.txContext.getStore();
    if (!active) throw new Error('transactionGet must be called inside a Cloud SQL transaction.');
    return this.getDoc(collectionName, id, true);
  }

  async transactionSet(collectionName: string, id: string, data: any, merge = true) {
    const active = this.txContext.getStore();
    if (!active) throw new Error('transactionSet must be called inside a Cloud SQL transaction.');
    return this.setDoc(collectionName, id, data, merge);
  }

  async rawDelete(collectionName: string, id: string) {
    return this.deleteDoc(collectionName, id);
  }
}

export class FirestoreService {
  readonly realtimeDb: Firestore;
  private readonly app: App;
  private readonly postgres: PostgresService | null;
  private sqlDb: SqlPersistenceDb | null = null;

  readonly user: Delegate;
  readonly refreshToken: Delegate;
  readonly authAuditLog: Delegate;
  readonly profile: Delegate;
  readonly kycRecord: Delegate;
  readonly wallet: Delegate;
  readonly transaction: Delegate;
  readonly deposit: Delegate;
  readonly withdrawal: Delegate;
  readonly subscription: Delegate;
  readonly subscriptionPayment: Delegate;
  readonly scoringRuleSet: Delegate;
  readonly contest: Delegate;
  readonly contestEntry: Delegate;
  readonly fantasyTeam: Delegate;
  readonly fantasyTeamPlayer: Delegate;
  readonly fantasyTeamEditHistory: Delegate;
  readonly leaderboardSnapshot: Delegate;
  readonly playerFixtureCredit: Delegate;
  readonly cachedFixture: Delegate;
  readonly cachedPlayer: Delegate;

  constructor(postgres: PostgresService | null = null) {
    this.postgres = postgres;

    if (getApps().length) this.app = getApps()[0]!;
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      this.app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'crickx-3d806';
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      this.app = initializeApp({ credential: cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey }) });
    } else {
      this.app = initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'crickx-3d806' });
    }
    this.realtimeDb = getFirestore(this.app);

    this.user = this.delegate('user');
    this.refreshToken = this.delegate('refreshToken');
    this.authAuditLog = this.delegate('authAuditLog');
    this.profile = this.delegate('profile');
    this.kycRecord = this.delegate('kycRecord');
    this.wallet = this.delegate('wallet');
    this.transaction = this.delegate('transaction');
    this.deposit = this.delegate('deposit');
    this.withdrawal = this.delegate('withdrawal');
    this.subscription = this.delegate('subscription');
    this.subscriptionPayment = this.delegate('subscriptionPayment');
    this.scoringRuleSet = this.delegate('scoringRuleSet');
    this.contest = this.delegate('contest');
    this.contestEntry = this.delegate('contestEntry');
    this.fantasyTeam = this.delegate('fantasyTeam');
    this.fantasyTeamPlayer = this.delegate('fantasyTeamPlayer');
    this.fantasyTeamEditHistory = this.delegate('fantasyTeamEditHistory');
    this.leaderboardSnapshot = this.delegate('leaderboardSnapshot');
    this.playerFixtureCredit = this.delegate('playerFixtureCredit');
    this.cachedFixture = this.delegate('cachedFixture');
    this.cachedPlayer = this.delegate('cachedPlayer');
  }

  private primaryEnabled() {
    const mode = String(process.env.CRICKX_PRIMARY_STORAGE ?? process.env.CRICKX_CONTEST_STORAGE ?? '').trim().toLowerCase();
    return Boolean(this.postgres?.isEnabled()) && ['postgres', 'postgresql', 'neon', 'cloudsql', 'true'].includes(mode);
  }

  private primaryDb() {
    if (!this.primaryEnabled()) return null;
    if (!this.sqlDb) this.sqlDb = new SqlPersistenceDb(this.postgres!.getPool());
    return this.sqlDb;
  }

  get db(): DatabaseCompat {
    return (this.primaryDb() ?? (this.realtimeDb as unknown as DatabaseCompat));
  }

  private delegate(model: string): Delegate {
    return {
      findUnique: (args) => this.findUnique(model, args),
      findFirst: (args) => this.findFirstOp(model, args),
      findMany: (args) => this.findMany(model, args),
      create: (args) => this.create(model, args),
      update: (args) => this.update(model, args),
      updateMany: (args) => this.updateMany(model, args),
      deleteMany: (args) => this.deleteMany(model, args),
      count: (args) => this.count(model, args),
      aggregate: (args) => this.aggregate(model, args),
      upsert: (args) => this.upsert(model, args),
    };
  }

  private col(model: string): any {
    return this.db.collection(COLLECTIONS[model] ?? (model + 's'));
  }

  private ref(model: string, id: string): any {
    return this.col(model).doc(id);
  }

  private expandWhere(where: any) {
    if (!where) return where;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(where)) {
      if (k.includes('_') && isPlainObject(v)) Object.assign(out, v);
      else out[k] = v;
    }
    return out;
  }

  private stableKeyId(value: unknown) {
    return createHash('sha256').update(String(value)).digest('hex');
  }

  private uniqueDirectId(model: string, where: any): string | null {
    if (!where) return null;
    if (typeof where.id === 'string') return where.id;
    if (model === 'transaction' && where.idempotencyKey !== undefined) return this.stableKeyId(where.idempotencyKey);
    if (model === 'refreshToken' && where.tokenHash !== undefined) return this.stableKeyId(where.tokenHash);
    if (model === 'cachedFixture' && where.sportmonksFixtureId !== undefined) return String(where.sportmonksFixtureId);
    if (model === 'cachedPlayer' && where.sportmonksPlayerId !== undefined) return String(where.sportmonksPlayerId);
    if (model === 'wallet' && where.userId !== undefined) return String(where.userId);
    return null;
  }

  private legacyFindRows(model: string, args: any = {}) {
    const collection = this.realtimeDb.collection(COLLECTIONS[model] ?? (model + 's'));
    const where = this.expandWhere(args?.where);
    let query: any = collection;
    const entries = where && typeof where === 'object' ? Object.entries(where) : [];
    const canUseServerFilter = entries.length > 0 && !('AND' in where) && !('OR' in where);
    if (canUseServerFilter) {
      for (const [field, expected] of entries) {
        if (expected && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected) && !(expected instanceof FirestoreDecimal)) {
          if ('in' in expected) query = query.where(field, 'in', (expected as any).in);
          else if ('notIn' in expected) query = query.where(field, 'not-in', (expected as any).notIn);
          else if ('lt' in expected) query = query.where(field, '<', (expected as any).lt);
          else if ('lte' in expected) query = query.where(field, '<=', (expected as any).lte);
          else if ('gt' in expected) query = query.where(field, '>', (expected as any).gt);
          else if ('gte' in expected) query = query.where(field, '>=', (expected as any).gte);
          else if ('equals' in expected) query = query.where(field, '==', (expected as any).equals);
        } else if (expected instanceof FirestoreDecimal) query = query.where(field, '==', expected.toNumber());
        else if (expected instanceof Date) query = query.where(field, '==', expected);
        else query = query.where(field, '==', expected);
      }
    }
    return query.get().then((snapshot: any) => {
      let rows = snapshot.docs.map((d: any) => decorateRecord(model, { id: d.id, ...(d.data() as any) }));
      rows = rows.filter((r: any) => whereMatches(r, where));
      return sortRows(rows, args?.orderBy);
    });
  }

  private async migrateLegacyRows(model: string, rows: any[]) {
    if (!this.primaryEnabled() || !rows.length) return;
    const collection = this.col(model);
    for (const row of rows) {
      const id = String(row.id ?? randomUUID());
      const data = { ...row };
      delete data.id;
      await collection.doc(id).set(data, { merge: false });
    }
  }

  private async findRows(model: string, args: any = {}) {
    const where = this.expandWhere(args?.where);
    const query = this.col(model);
    const entries = where && typeof where === 'object' ? Object.entries(where) : [];
    const simple = entries.length > 0 && !('AND' in where) && !('OR' in where);

    if (simple) {
      for (const [field, expected] of entries) {
        if (expected && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected) && !(expected instanceof FirestoreDecimal)) {
          if ('in' in expected) query.where(field, 'in', (expected as any).in);
          else if ('notIn' in expected) query.where(field, 'not-in', (expected as any).notIn);
          else if ('lt' in expected) query.where(field, '<', (expected as any).lt);
          else if ('lte' in expected) query.where(field, '<=', (expected as any).lte);
          else if ('gt' in expected) query.where(field, '>', (expected as any).gt);
          else if ('gte' in expected) query.where(field, '>=', (expected as any).gte);
          else if ('equals' in expected) query.where(field, '==', (expected as any).equals);
        } else if (expected instanceof FirestoreDecimal) query.where(field, '==', expected.toNumber());
        else if (expected instanceof Date) query.where(field, '==', expected);
        else query.where(field, '==', expected);
      }
    }

    let rows: any[] = (await query.get()).docs.map((d: any) => decorateRecord(model, { id: d.id, ...(d.data() as any) }));
    rows = rows.filter((r) => whereMatches(r, where));
    rows = sortRows(rows, args?.orderBy);
    if (args?.skip) rows = rows.slice(Number(args.skip));
    if (args?.take !== undefined) rows = rows.slice(0, Number(args.take));
    return rows;
  }

  private async maybeMigrateOnMiss(model: string, args: any, rows: any[]) {
    if (this.primaryEnabled() || rows.length || ['cachedFixture', 'cachedPlayer'].includes(model)) return rows;
    try {
      const legacy = await this.legacyFindRows(model, args);
      if (legacy.length) {
        await this.migrateLegacyRows(model, legacy);
        return legacy;
      }
    } catch {
      // Migration is best-effort. The SQL store remains authoritative.
    }
    return rows;
  }

  async findUnique(model: string, args: any) {
    const where = this.expandWhere(args?.where);
    const direct = this.uniqueDirectId(model, where);
    let row: any = null;
    if (direct) {
      const snap = await this.ref(model, direct).get();
      row = snap.exists ? decorateRecord(model, { id: snap.id, ...(snap.data() as any) }) : null;
    }
    if (!row) row = (await this.findRows(model, { where }))[0] ?? null;
    if (!row) row = (await this.maybeMigrateOnMiss(model, { where }, []))[0] ?? null;
    return row ? this.hydrate(model, row, args?.include, args?.select) : null;
  }

  async findFirstOp(model: string, args: any) {
    let rows = await this.findRows(model, args);
    rows = await this.maybeMigrateOnMiss(model, args, rows);
    const row = rows[0] ?? null;
    return row ? this.hydrate(model, row, args?.include, args?.select) : null;
  }

  async findMany(model: string, args: any = {}) {
    let rows = await this.findRows(model, args);
    rows = await this.maybeMigrateOnMiss(model, args, rows);
    return Promise.all(rows.map((r) => this.hydrate(model, r, args?.include, args?.select)));
  }

  private async createRecord(model: string, args: any) {
    const data = unwrap(args.data ?? {}) as Record<string, any>;
    const id = String(data.id ?? (
      model === 'transaction' && data.idempotencyKey ? this.stableKeyId(data.idempotencyKey) :
      model === 'refreshToken' && data.tokenHash ? this.stableKeyId(data.tokenHash) :
      randomUUID()
    ));
    delete data.id;
    const now = new Date();
    if (data.createdAt === undefined) data.createdAt = now;
    if (['user', 'profile', 'wallet', 'scoringRuleSet', 'contest', 'fantasyTeam'].includes(model) && data.updatedAt === undefined) data.updatedAt = now;

    await this.ref(model, id).set(data, { merge: false });

    if (model === 'user') {
      const profile = args.data?.profile?.create;
      const wallet = args.data?.wallet?.create;
      if (profile) await this.create('profile', { data: { ...(profile as any), userId: id } });
      if (wallet) await this.create('wallet', { data: { ...(wallet as any), userId: id, id } });
    } else if (model === 'fantasyTeam') {
      const players = Array.isArray(args.data?.players?.create) ? args.data.players.create : [];
      for (const player of players) await this.create('fantasyTeamPlayer', { data: { ...(player as any), fantasyTeamId: id } });
    }

    const row = await this.ref(model, id).get();
    return this.hydrate(model, row.exists ? decorateRecord(model, { id, ...(row.data() as any) }) : { id, ...data }, args?.include, args?.select);
  }

  async create(model: string, args: any, modelOverride?: string) {
    return this.createRecord(modelOverride ?? model, args);
  }

  async update(model: string, args: any) {
    const current = await this.findUnique(model, { where: args.where });
    if (!current) throw new Error(model + ' record not found');

    const patch = { ...(args.data ?? {}) };
    const nestedPlayers = patch.players?.create;
    delete patch.players;
    const updated = this.applyPatch(current, patch);

    await this.ref(model, String(current.id)).update(updated);

    if (model === 'fantasyTeam' && Array.isArray(nestedPlayers)) {
      for (const p of nestedPlayers) await this.create('fantasyTeamPlayer', { data: { ...(p as any), fantasyTeamId: current.id } });
    }
    const row = await this.ref(model, String(current.id)).get();
    return this.hydrate(model, row.data(), args?.include, args?.select);
  }

  private applyPatch(base: any, patch: any) {
    const out = { ...base };
    for (const [key, value] of Object.entries(patch ?? {})) {
      if (value === undefined) continue;
      if (isPlainObject(value) && 'increment' in value) out[key] = Number(out[key] ?? 0) + Number((value as any).increment);
      else if (isPlainObject(value) && 'decrement' in value) out[key] = Number(out[key] ?? 0) - Number((value as any).decrement);
      else out[key] = unwrap(value);
    }
    if ('updatedAt' in out) out.updatedAt = new Date();
    return out;
  }

  async updateMany(model: string, args: any) {
    const rows = await this.findRows(model, { where: args.where });
    for (const row of rows) await this.ref(model, String(row.id)).update(args.data);
    return { count: rows.length };
  }

  async deleteMany(model: string, args: any) {
    const rows = await this.findRows(model, { where: args.where });
    for (const row of rows) await this.ref(model, String(row.id)).delete();
    return { count: rows.length };
  }

  async count(model: string, args: any = {}) {
    const rows = await this.findMany(model, args);
    return rows.length;
  }

  async aggregate(model: string, args: any) {
    const rows = await this.findRows(model, { where: args?.where });
    const sum: Record<string, any> = {};
    for (const field of Object.keys(args?._sum ?? {})) {
      const value = rows.reduce((acc, r) => acc + Number(scalar(r[field]) ?? 0), 0);
      sum[field] = value || null;
    }
    return { _sum: sum };
  }

  async upsert(model: string, args: any) {
    const where = this.expandWhere(args.where);
    const existing = (await this.findRows(model, { where }))[0] ?? null;
    if (existing) return this.update(model, { where: { id: existing.id }, data: args.update });
    return this.create(model, { data: args.create });
  }

  async $transaction<T>(arg: ((tx: this) => Promise<T>) | Array<Promise<T>>): Promise<T | T[]> {
    const primary = this.primaryDb();
    if (Array.isArray(arg)) return Promise.all(arg);
    if (primary) return primary.runTransaction(() => arg(this));
    return this.realtimeDb.runTransaction((t: any) => {
      // Legacy mode is retained only when Cloud SQL is not enabled.
      return Promise.resolve(arg(this));
    }) as Promise<T>;
  }

  async rawDelete(model: string, id: string) {
    return this.ref(model, id).delete();
  }

  async transactionGet(collectionName: string, id: string) {
    const primary = this.primaryDb();
    if (primary) return primary.transactionGet(collectionName, id);
    throw new Error('transactionGet is only available inside a Cloud SQL transaction when primary storage is enabled.');
  }

  async transactionSet(collectionName: string, id: string, data: Record<string, unknown>, merge = true) {
    const primary = this.primaryDb();
    if (primary) return primary.transactionSet(collectionName, id, data, merge);
    throw new Error('transactionSet is only available inside a Cloud SQL transaction when primary storage is enabled.');
  }

  private async migrateLegacyDoc(model: string, id: string) {
    try {
      const snap = await this.realtimeDb.collection(COLLECTIONS[model] ?? (model + 's')).doc(id).get();
      if (!snap.exists) return null;
      const row = decorateRecord(model, { id: snap.id, ...(snap.data() as any) });
      if (this.primaryEnabled()) {
        const data = { ...row };
        delete data.id;
        await this.ref(model, id).set(data, { merge: false });
      }
      return row;
    } catch {
      return null;
    }
  }

  private async hydrate(model: string, row: any, include?: any, select?: any): Promise<any> {
    let out = decorateRecord(model, unwrap(row) as any);
    if (model === 'user' && include?.profile) out.profile = await this.findUnique('profile', { where: { userId: row.id } });
    if (model === 'refreshToken' && include?.user) out.user = await this.findUnique('user', { where: { id: row.userId } });
    if (model === 'fantasyTeam' && include?.players) out.players = await this.findMany('fantasyTeamPlayer', { where: { fantasyTeamId: row.id }, orderBy: { id: 'asc' } });
    if (model === 'contestEntry') {
      if (include?.contest) out.contest = await this.findUnique('contest', { where: { id: row.contestId }, include: include.contest === true ? undefined : include.contest.include });
      if (include?.fantasyTeam) out.fantasyTeam = await this.findUnique('fantasyTeam', { where: { id: row.fantasyTeamId }, include: include.fantasyTeam === true ? undefined : include.fantasyTeam.include });
    }
    if (model === 'contest' && include?.entries) out.entries = await this.findMany('contestEntry', { where: { contestId: row.id }, include: include.entries === true ? undefined : include.entries.include });
    if (model === 'kycRecord' && include?.user) out.user = await this.findUnique('user', { where: { id: row.userId }, include: include.user === true ? undefined : include.user.include, select: include.user?.select });
    if (select) out = Object.fromEntries(Object.entries(out).filter(([key]) => select[key]));
    return out;
  }
}

export { FirestoreService as PrismaService };
