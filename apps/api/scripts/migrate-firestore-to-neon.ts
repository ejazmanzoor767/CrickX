import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { Pool } from 'pg';

const COLLECTIONS = [
  'users',
  'refreshTokens',
  'authAuditLogs',
  'profiles',
  'kycRecords',
  'wallets',
  'transactions',
  'deposits',
  'withdrawals',
  'subscriptions',
  'subscriptionPayments',
  'scoringRuleSets',
  'contests',
  'contestEntries',
  'fantasyTeams',
  'fantasyTeamPlayers',
  'fantasyTeamEditHistory',
  'leaderboardSnapshots',
  'playerFixtureCredits',
  'cachedFixtures',
  'cachedPlayers',
  'predictionMatches',
  'predictionEntries',
  'predictionAnswers',
  'predictionWalletLocks',
] as const;

function initFirestore() {
  if (getApps().length) return getFirestore(getApps()[0]!);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return getFirestore(initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    }));
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'crickx-3d806';
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    return getFirestore(initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    }));
  }
  return getFirestore(initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'crickx-3d806',
  }));
}

function serialise(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof (value as any).toDate === 'function') return (value as any).toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = serialise(child);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return value;
}

async function ensureSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crickx_contests (
      id TEXT PRIMARY KEY,
      sportmonks_fixture_id BIGINT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      entry_fee NUMERIC(38,18) NOT NULL DEFAULT 0,
      total_spots INTEGER NULL,
      filled_spots INTEGER NOT NULL DEFAULT 0,
      prize_pool_total NUMERIC(38,18) NOT NULL DEFAULT 0,
      prize_pool_funding_status TEXT NOT NULL DEFAULT 'PENDING_MATCH_START',
      prize_pool_funded_amount NUMERIC(38,18) NOT NULL DEFAULT 0,
      prize_pool_funding_tx_hash TEXT NULL,
      prize_pool_funding_at TIMESTAMPTZ NULL,
      prize_pool_funding_error TEXT NULL,
      prize_distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
      scoring_rule_set_id TEXT NULL,
      lineup_lock_at TIMESTAMPTZ NULL,
      max_teams_per_user INTEGER NOT NULL DEFAULT 1,
      chain_contest_id BIGINT NULL,
      status TEXT NOT NULL DEFAULT 'UPCOMING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS crickx_contest_entries (
      id TEXT PRIMARY KEY,
      contest_id TEXT NOT NULL REFERENCES crickx_contests(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      fantasy_team_id TEXT NOT NULL,
      entry_fee_paid NUMERIC(38,18) NOT NULL DEFAULT 0,
      transaction_hash TEXT NULL,
      wallet_address TEXT NULL,
      payment_status TEXT NOT NULL DEFAULT 'SUBSCRIPTION_ACTIVE',
      total_points NUMERIC(20,4) NOT NULL DEFAULT 0,
      rank INTEGER NULL,
      prize_won NUMERIC(38,18) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (contest_id, user_id),
      UNIQUE (contest_id, fantasy_team_id)
    );
    CREATE TABLE IF NOT EXISTS crickx_contest_wallet_locks (
      contest_id TEXT NOT NULL REFERENCES crickx_contests(id) ON DELETE CASCADE,
      wallet_address TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (contest_id, wallet_address)
    );
    CREATE TABLE IF NOT EXISTS crickx_records (
      collection_name TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection_name, id)
    );
    CREATE INDEX IF NOT EXISTS crickx_records_collection_updated_idx
      ON crickx_records (collection_name, updated_at DESC);
    CREATE INDEX IF NOT EXISTS crickx_records_data_gin_idx
      ON crickx_records USING GIN (data);
  `);
}

async function migrateCollection(pool: Pool, db: ReturnType<typeof getFirestore>, collectionName: string) {
  let last: QueryDocumentSnapshot<DocumentData> | undefined;
  let migrated = 0;

  while (true) {
    let query = db.collection(collectionName).orderBy('__name__').limit(400);
    if (last) query = query.startAfter(last);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const data = serialise(doc.data()) ?? {};
      await pool.query(
        `INSERT INTO crickx_records (collection_name, id, data, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW(), NOW())
         ON CONFLICT (collection_name, id) DO NOTHING`,
        [collectionName, doc.id, JSON.stringify(data)],
      );
      migrated += 1;
    }

    last = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < 400) break;
  }

  return migrated;
}

async function migrateContests(pool: Pool, db: ReturnType<typeof getFirestore>) {
  let contests = 0;
  let entries = 0;

  const contestSnapshot = await db.collection('contests').get();
  for (const doc of contestSnapshot.docs) {
    const row: any = { id: doc.id, ...doc.data() };
    if (!Number.isFinite(Number(row.sportmonksFixtureId))) continue;

    await pool.query(
      `INSERT INTO crickx_contests (
        id, sportmonks_fixture_id, name, entry_fee, total_spots, filled_spots, prize_pool_total,
        prize_pool_funding_status, prize_pool_funded_amount, prize_pool_funding_tx_hash,
        prize_pool_funding_at, prize_pool_funding_error, prize_distribution, scoring_rule_set_id,
        lineup_lock_at, max_teams_per_user, chain_contest_id, status, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        String(row.id),
        Number(row.sportmonksFixtureId),
        String(row.name ?? 'CrickX Champions Contest'),
        Number(row.entryFee ?? 0),
        row.totalSpots == null ? null : Number(row.totalSpots),
        Number(row.filledSpots ?? 0),
        Number(row.prizePoolTotal ?? 0),
        String(row.prizePoolFundingStatus ?? 'PENDING_MATCH_START'),
        Number(row.prizePoolFundedAmount ?? 0),
        row.prizePoolFundingTxHash ?? null,
        row.prizePoolFundingAt ? new Date(row.prizePoolFundingAt) : null,
        row.prizePoolFundingError ?? null,
        JSON.stringify(row.prizeDistribution ?? []),
        row.scoringRuleSetId ?? null,
        row.lineupLockAt ? new Date(row.lineupLockAt) : null,
        Number(row.maxTeamsPerUser ?? 1),
        Number.isFinite(Number(row.chainContestId)) && Number(row.chainContestId) > 0 ? Number(row.chainContestId) : null,
        String(row.status ?? 'UPCOMING'),
        row.createdAt ? new Date(row.createdAt) : new Date(),
        row.updatedAt ? new Date(row.updatedAt) : new Date(),
      ],
    );
    contests += 1;
  }

  const entrySnapshot = await db.collection('contestEntries').get();
  for (const doc of entrySnapshot.docs) {
    const row: any = { id: doc.id, ...doc.data() };
    if (!row.contestId) continue;

    await pool.query(
      `INSERT INTO crickx_contest_entries (
        id, contest_id, user_id, fantasy_team_id, entry_fee_paid,
        transaction_hash, wallet_address, payment_status, total_points, rank, prize_won,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
      ON CONFLICT (id) DO NOTHING`,
      [
        String(row.id),
        String(row.contestId),
        String(row.userId),
        String(row.fantasyTeamId),
        Number(row.entryFeePaid ?? 0),
        row.transactionHash ?? null,
        row.walletAddress ?? null,
        String(row.paymentStatus ?? 'SUBSCRIPTION_ACTIVE'),
        Number(row.totalPoints ?? 0),
        row.rank == null ? null : Number(row.rank),
        row.prizeWon == null ? null : Number(row.prizeWon),
        row.createdAt ? new Date(row.createdAt) : new Date(),
      ],
    );

    if (row.walletAddress && row.userId) {
      await pool.query(
        `INSERT INTO crickx_contest_wallet_locks (contest_id, wallet_address, user_id)
         VALUES ($1, lower($2), $3)
         ON CONFLICT (contest_id, wallet_address) DO NOTHING`,
        [String(row.contestId), String(row.walletAddress), String(row.userId)],
      );
    }
    entries += 1;
  }

  const contestsWithEntries = await pool.query(`
    UPDATE crickx_contests c
    SET filled_spots = counts.entry_count,
        prize_pool_total = counts.entry_count * 10,
        updated_at = NOW()
    FROM (
      SELECT contest_id, COUNT(*)::int AS entry_count
      FROM crickx_contest_entries
      GROUP BY contest_id
    ) counts
    WHERE c.id = counts.contest_id
      AND counts.entry_count > 0
  `);

  return { contests, entries, updatedContests: contestsWithEntries.rowCount ?? 0 };
}

async function main() {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Set NEON_DATABASE_URL or DATABASE_URL before running this migration.');

  const db = initFirestore();
  const pool = new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10_000,
    ssl: String(process.env.POSTGRES_SSL ?? 'true').toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
    application_name: 'crickx-firestore-to-neon-migration',
  });

  try {
    await ensureSchema(pool);

    const totals: Record<string, number> = {};
    for (const collection of COLLECTIONS) {
      totals[collection] = await migrateCollection(pool, db, collection);
    }

    const contestTotals = await migrateContests(pool, db);
    console.log(JSON.stringify({ migratedRecords: totals, contestTotals }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
