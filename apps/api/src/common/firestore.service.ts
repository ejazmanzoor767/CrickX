import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { CollectionReference, Firestore, Transaction, getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

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
  contest: new Set(['entryFee', 'prizePoolTotal']),
  contestEntry: new Set(['entryFeePaid', 'totalPoints', 'prizeWon']),
  fantasyTeamPlayer: new Set(['creditsAtSelection']),
  playerFixtureCredit: new Set(['credits']),
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof FirestoreDecimal);
}

function unwrap(value: unknown): unknown {
  if (value instanceof FirestoreDecimal) return value.toNumber();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(unwrap);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = unwrap(v);
    return out;
  }
  return value;
}

function decorateRecord(model: string, data: Record<string, any>): Record<string, any> {
  const out = { ...data };
  for (const field of DECIMAL_FIELDS[model] ?? new Set<string>()) {
    if (out[field] !== null && out[field] !== undefined && !(out[field] instanceof FirestoreDecimal)) {
      out[field] = new FirestoreDecimal(Number(out[field]));
    }
  }
  return out;
}

function whereMatches(record: Record<string, any>, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'AND' && Array.isArray(expected)) return expected.every((w) => whereMatches(record, w));
    if (field === 'OR' && Array.isArray(expected)) return expected.some((w) => whereMatches(record, w));
    const actual = record[field] instanceof FirestoreDecimal ? record[field].toNumber() : record[field];
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
    if (expected instanceof Date) return new Date(actual).getTime() === expected.getTime();
    return actual === expected;
  });
}

function sortRows(rows: any[], orderBy: any): any[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      const [field, direction] = Object.entries(spec)[0] as [string, string];
      const av = a[field] instanceof FirestoreDecimal ? a[field].toNumber() : a[field];
      const bv = b[field] instanceof FirestoreDecimal ? b[field].toNumber() : b[field];
      if (av === bv) continue;
      const cmp = av < bv ? -1 : 1;
      return direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

@Injectable()
export class FirestoreService implements OnModuleInit, OnModuleDestroy {
  readonly db: Firestore;
  private readonly app: App;
  private readonly transactionContext = new AsyncLocalStorage<Transaction>();

  constructor() {
    if (getApps().length) this.app = getApps()[0]!;
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      this.app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
    } else {
      this.app = initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'crickx-3d806' });
    }
    this.db = getFirestore(this.app);
  }

  async onModuleInit() {}
  async onModuleDestroy() {}

  private col(model: string): CollectionReference {
    const map: Record<string, string> = {
      user: 'users', refreshToken: 'refreshTokens', authAuditLog: 'authAuditLogs', profile: 'profiles', kycRecord: 'kycRecords',
      wallet: 'wallets', transaction: 'transactions', deposit: 'deposits', withdrawal: 'withdrawals', scoringRuleSet: 'scoringRuleSets',
      contest: 'contests', contestEntry: 'contestEntries', fantasyTeam: 'fantasyTeams', fantasyTeamPlayer: 'fantasyTeamPlayers',
      fantasyTeamEditHistory: 'fantasyTeamEditHistory', leaderboardSnapshot: 'leaderboardSnapshots', playerFixtureCredit: 'playerFixtureCredits',
      cachedFixture: 'cachedFixtures', cachedPlayer: 'cachedPlayers',
    };
    return this.db.collection(map[model] ?? `${model}s`);
  }

  private ref(model: string, id: string) { return this.col(model).doc(id); }

  private expandWhere(where: any) {
    if (!where) return where;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(where)) {
      if (k.includes('_') && isPlainObject(v)) Object.assign(out, v); else out[k] = v;
    }
    return out;
  }

  private uniqueDirectId(model: string, where: any): string | null {
    if (!where) return null;
    if (typeof where.id === 'string') return where.id;
    if (model === 'cachedFixture' && where.sportmonksFixtureId !== undefined) return String(where.sportmonksFixtureId);
    if (model === 'cachedPlayer' && where.sportmonksPlayerId !== undefined) return String(where.sportmonksPlayerId);
    if (model === 'wallet' && where.userId !== undefined) return String(where.userId);
    return null;
  }

  private async readDoc(model: string, id: string) {
    const snap = this.transactionContext.getStore() ? await this.transactionContext.getStore()!.get(this.ref(model, id)) : await this.ref(model, id).get();
    return snap.exists ? decorateRecord(model, { id: snap.id, ...(snap.data() as any) }) : null;
  }

  private async getAll(model: string): Promise<any[]> {
    const docs = (await this.col(model).get()).docs;
    return docs.map((d) => decorateRecord(model, { id: d.id, ...(d.data() as any) }));
  }

  private async findRows(model: string, args: any = {}) {
    let rows = await this.getAll(model);
    rows = rows.filter((r) => whereMatches(r, this.expandWhere(args?.where)));
    rows = sortRows(rows, args?.orderBy);
    if (args?.skip) rows = rows.slice(Number(args.skip));
    if (args?.take !== undefined) rows = rows.slice(0, Number(args.take));
    return rows;
  }

  async findUnique(model: string, args: any) {
    const where = this.expandWhere(args?.where);
    let row = null;
    const direct = this.uniqueDirectId(model, where);
    if (direct) row = await this.readDoc(model, direct);
    if (!row) row = (await this.findRows(model, { where }))[0] ?? null;
    return row ? this.hydrate(model, row, args?.include, args?.select) : null;
  }
  async findFirstOp(model: string, args: any) {
    const row = (await this.findRows(model, args))[0] ?? null;
    return row ? this.hydrate(model, row, args?.include, args?.select) : null;
  }
  async findMany(model: string, args: any = {}) {
    return Promise.all((await this.findRows(model, args)).map((r) => this.hydrate(model, r, args?.include, args?.select)));
  }

  private async write(model: string, id: string, data: any, merge = true) {
    const ref = this.ref(model, id);
    const payload = unwrap(data) as any;
    const tx = this.transactionContext.getStore();
    if (tx) tx.set(ref, payload, { merge }); else await ref.set(payload, { merge });
  }

  async create(model: string, args: any) {
    const data = unwrap(args.data ?? {}) as Record<string, any>;
    const id = String(data.id ?? randomUUID());
    delete data.id;
    const now = new Date();
    if (data.createdAt === undefined) data.createdAt = now;
    if (['user','profile','wallet','scoringRuleSet','contest','fantasyTeam'].includes(model) && data.updatedAt === undefined) data.updatedAt = now;
    // Handle nested one-to-one and one-to-many creates used by the current app.
    if (model === 'user') {
      const profile = args.data?.profile?.create;
      const wallet = args.data?.wallet?.create;
      delete data.profile; delete data.wallet;
      await this.write(model, id, data, false);
      if (profile) await this.create('profile', { data: { ...profile, userId: id }, include: undefined });
      if (wallet) await this.create('wallet', { data: { ...wallet, userId: id, id }, include: undefined });
    } else if (model === 'fantasyTeam') {
      const players = Array.isArray(args.data?.players?.create) ? args.data.players.create : [];
      delete data.players;
      await this.write(model, id, data, false);
      for (const p of players) await this.create('fantasyTeamPlayer', { data: { ...p, fantasyTeamId: id } });
    } else {
      await this.write(model, id, data, false);
    }
    const row = await this.readDoc(model, id);
    return this.hydrate(model, row!, args?.include, args?.select);
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

  async update(model: string, args: any) {
    const current = await this.findUnique(model, { where: this.expandWhere(args.where) });
    if (!current) throw new Error(`${model} record not found`);
    const patch = { ...(args.data ?? {}) };
    const nestedPlayers = patch.players?.create;
    delete patch.players;
    const updated = this.applyPatch(current, patch);
    await this.write(model, current.id, updated, true);
    if (model === 'fantasyTeam' && Array.isArray(nestedPlayers)) {
      for (const p of nestedPlayers) await this.create('fantasyTeamPlayer', { data: { ...p, fantasyTeamId: current.id } });
    }
    const row = await this.readDoc(model, current.id);
    return this.hydrate(model, row!, args?.include, args?.select);
  }

  async updateMany(model: string, args: any) {
    if (model === 'wallet' && args?.where?.userId !== undefined) {
      const row = await this.findUnique(model, { where: { userId: args.where.userId } });
      if (!row || !whereMatches(row, this.expandWhere(args.where))) return { count: 0 };
      await this.write(model, row.id, this.applyPatch(row, args.data), true);
      return { count: 1 };
    }
    const rows = await this.findRows(model, { where: args.where });
    for (const row of rows) await this.write(model, row.id, this.applyPatch(row, args.data), true);
    return { count: rows.length };
  }

  async deleteMany(model: string, args: any) {
    const rows = await this.findRows(model, { where: args.where });
    for (const row of rows) {
      const r = this.ref(model, row.id);
      const tx = this.transactionContext.getStore();
      if (tx) tx.delete(r); else await r.delete();
    }
    return { count: rows.length };
  }

  async count(model: string, args: any = {}) { return (await this.findRows(model, args)).length; }
  async aggregate(model: string, args: any) {
    const rows = await this.findRows(model, { where: args?.where });
    const sum: Record<string, any> = {};
    for (const field of Object.keys(args?._sum ?? {})) {
      const value = rows.reduce((acc, r) => acc + Number(r[field] instanceof FirestoreDecimal ? r[field].toNumber() : (r[field] ?? 0)), 0);
      sum[field] = value || null;
    }
    return { _sum: sum };
  }

  async upsert(model: string, args: any) {
    const where = this.expandWhere(args.where);
    const existing = (await this.findRows(model, { where }))[0] ?? null;
    if (existing) return this.update(model, { where: { id: existing.id }, data: args.update });
    return this.create(model, { data: { ...(args.create ?? {}), ...(model === 'cachedFixture' ? { id: String(args.create.sportmonksFixtureId) } : {}), ...(model === 'cachedPlayer' ? { id: String(args.create.sportmonksPlayerId) } : {}) } });
  }

  async $transaction<T>(arg: ((tx: this) => Promise<T>) | Array<Promise<T>>): Promise<T | T[]> {
    if (Array.isArray(arg)) return Promise.all(arg);
    return this.db.runTransaction((t) => this.transactionContext.run(t, () => arg(this)));
  }

  async rawDelete(model: string, id: string) {
    const r = this.ref(model, id);
    const tx = this.transactionContext.getStore();
      if (tx) tx.delete(r); else await r.delete();
  }

  private async hydrate(model: string, row: any, include?: any, select?: any): Promise<any> {
    let out = decorateRecord(model, unwrap(row) as any);
    if (model === 'user' && include?.profile) out.profile = await this.findUnique('profile', { where: { userId: row.id } });
    if (model === 'refreshToken' && include?.user) out.user = await this.findUnique('user', { where: { id: row.userId } });
    if (model === 'fantasyTeam' && include?.players) out.players = await this.findMany('fantasyTeamPlayer', { where: { fantasyTeamId: row.id }, orderBy: { id: 'asc' } });
    if (model === 'contestEntry') {
      if (include?.contest) out.contest = await this.findUnique('contest', { where: { id: row.contestId }, include: include.contest === true ? undefined : include.contest.include });
      if (include?.fantasyTeam) out.fantasyTeam = await this.findUnique('fantasyTeam', { where: { id: row.fantasyTeamId }, include: include.fantasyTeam === true ? undefined : include.fantasyTeam.include });
      if (include?.user) out.user = await this.findUnique('user', { where: { id: row.userId }, select: include.user === true ? undefined : include.user.select });
    }
    if (model === 'contest') {
      if (include?.scoringRuleSet) out.scoringRuleSet = await this.findUnique('scoringRuleSet', { where: { id: row.scoringRuleSetId } });
      if (include?.entries) out.entries = await this.findMany('contestEntry', { where: { contestId: row.id }, include: include.entries === true ? undefined : include.entries.include });
    }
    if ((model === 'kycRecord' || model === 'withdrawal') && include?.user) out.user = await this.findUnique('user', { where: { id: row.userId }, select: include.user === true ? undefined : include.user.select });
    if (select) {
      const picked: any = {};
      for (const [k, enabled] of Object.entries(select)) if (enabled && out[k] !== undefined) picked[k] = out[k];
      return picked;
    }
    return out;
  }

  readonly user = this.delegate('user');
  readonly refreshToken = this.delegate('refreshToken');
  readonly authAuditLog = this.delegate('authAuditLog');
  readonly profile = this.delegate('profile');
  readonly kycRecord = this.delegate('kycRecord');
  readonly wallet = this.delegate('wallet');
  readonly transaction = this.delegate('transaction');
  readonly deposit = this.delegate('deposit');
  readonly withdrawal = this.delegate('withdrawal');
  readonly scoringRuleSet = this.delegate('scoringRuleSet');
  readonly contest = this.delegate('contest');
  readonly contestEntry = this.delegate('contestEntry');
  readonly fantasyTeam = this.delegate('fantasyTeam');
  readonly fantasyTeamPlayer = this.delegate('fantasyTeamPlayer');
  readonly fantasyTeamEditHistory = this.delegate('fantasyTeamEditHistory');
  readonly leaderboardSnapshot = this.delegate('leaderboardSnapshot');
  readonly playerFixtureCredit = this.delegate('playerFixtureCredit');
  readonly cachedFixture = this.delegate('cachedFixture');
  readonly cachedPlayer = this.delegate('cachedPlayer');

  private delegate(model: string) {
    return {
      findUnique: (args: any) => this.findUnique(model, args),
      findFirst: (args: any) => this.findFirstOp(model, args),
      findMany: (args?: any) => this.findMany(model, args),
      create: (args: any) => this.create(model, args),
      update: (args: any) => this.update(model, args),
      updateMany: (args: any) => this.updateMany(model, args),
      deleteMany: (args: any) => this.deleteMany(model, args),
      count: (args?: any) => this.count(model, args),
      aggregate: (args: any) => this.aggregate(model, args),
      upsert: (args: any) => this.upsert(model, args),
    };
  }
}
