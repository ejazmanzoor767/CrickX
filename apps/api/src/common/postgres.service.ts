import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { Pool, type PoolClient } from 'pg';

export class PostgresContestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PostgresContestError';
  }
}

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private readonly connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';
  private readonly mode = String(process.env.CRICKX_CONTEST_STORAGE ?? 'auto').trim().toLowerCase();
  private readonly configured = Boolean(this.connectionString);
  private readonly required = ['postgres', 'true'].includes(this.mode);
  private pool: Pool | null = null;
  private ready = false;
  private lastBootstrapAt = 0;
  private readonly bootstrapCooldownMs = 2 * 60_000;

  isEnabled() {
    return this.ready;
  }

  getPool(): Pool {
    if (!this.pool || !this.ready) throw new Error('PostgreSQL pool is not ready.');
    return this.pool;
  }

  async onModuleInit() {
    if (!this.configured) {
      if (this.required) throw new Error('PostgreSQL primary storage requires NEON_DATABASE_URL or DATABASE_URL.');
      this.logger.log('PostgreSQL primary storage is not configured; Firestore realtime-only mode remains active.');
      return;
    }

    this.pool = new Pool({
      connectionString: this.connectionString,
      max: Math.max(2, Math.min(Number(process.env.POSTGRES_POOL_MAX ?? 5), 20)),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: String(process.env.POSTGRES_SSL ?? 'true').toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
      application_name: 'crickx-api',
    });

    this.pool.on('error', (error) => {
      this.logger.error(`PostgreSQL pool error: ${error instanceof Error ? error.message : String(error)}`);
    });

    try {
      await this.ensureSchema();
      this.ready = true;
      this.logger.log('Neon/PostgreSQL primary storage enabled.');
    } catch (error) {
      this.ready = false;
      this.logger.error(`Neon/PostgreSQL storage initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.required) throw error;
    }
  }

  async onModuleDestroy() {
    await this.pool?.end().catch(() => undefined);
    this.pool = null;
    this.ready = false;
  }

  private async ensureSchema() {
    if (!this.pool) throw new Error('PostgreSQL pool is not initialized.');
    await this.pool.query(`
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
      CREATE INDEX IF NOT EXISTS crickx_contests_status_lock_idx ON crickx_contests (status, lineup_lock_at);

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
      CREATE INDEX IF NOT EXISTS crickx_contest_entries_contest_rank_idx
        ON crickx_contest_entries (contest_id, total_points DESC, created_at ASC);
      CREATE UNIQUE INDEX IF NOT EXISTS crickx_contest_entries_wallet_idx
        ON crickx_contest_entries (contest_id, lower(wallet_address))
        WHERE wallet_address IS NOT NULL;

      CREATE TABLE IF NOT EXISTS crickx_contest_wallet_locks (
        contest_id TEXT NOT NULL REFERENCES crickx_contests(id) ON DELETE CASCADE,
        wallet_address TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (contest_id, wallet_address)
      );
      CREATE INDEX IF NOT EXISTS crickx_contest_wallet_locks_user_idx
        ON crickx_contest_wallet_locks (contest_id, user_id);

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
      CREATE UNIQUE INDEX IF NOT EXISTS crickx_records_user_email_idx
        ON crickx_records ((data->>'email'))
        WHERE collection_name = 'users' AND data ? 'email';
      CREATE UNIQUE INDEX IF NOT EXISTS crickx_records_refresh_token_hash_idx
        ON crickx_records ((data->>'tokenHash'))
        WHERE collection_name = 'refreshTokens' AND data ? 'tokenHash';
      CREATE UNIQUE INDEX IF NOT EXISTS crickx_records_transaction_idempotency_idx
        ON crickx_records ((data->>'idempotencyKey'))
        WHERE collection_name = 'transactions' AND data ? 'idempotencyKey';
      CREATE UNIQUE INDEX IF NOT EXISTS crickx_records_wallet_user_idx
        ON crickx_records ((data->>'userId'))
        WHERE collection_name = 'wallets' AND data ? 'userId';
    `);
  }

  private requirePool() {
    if (!this.ready || !this.pool) throw new Error('PostgreSQL contest storage is not ready.');
    return this.pool;
  }

  private async withClient<T>(fn: (client: PoolClient) => Promise<T>) {
    const client = await this.requirePool().connect();
    try { return await fn(client); } finally { client.release(); }
  }

  private mapContest(row: any) {
    if (!row) return null;
    return {
      id: String(row.id),
      sportmonksFixtureId: Number(row.sportmonks_fixture_id),
      name: String(row.name ?? 'CrickX Champions Contest'),
      entryFee: Number(row.entry_fee ?? 0),
      totalSpots: row.total_spots == null ? null : Number(row.total_spots),
      filledSpots: Number(row.filled_spots ?? 0),
      prizePoolTotal: Number(row.prize_pool_total ?? 0),
      prizePoolFundingStatus: String(row.prize_pool_funding_status ?? 'PENDING_MATCH_START'),
      prizePoolFundedAmount: Number(row.prize_pool_funded_amount ?? 0),
      prizePoolFundingTxHash: row.prize_pool_funding_tx_hash ?? null,
      prizePoolFundingAt: row.prize_pool_funding_at ? new Date(row.prize_pool_funding_at) : null,
      prizePoolFundingError: row.prize_pool_funding_error ?? null,
      prizeDistribution: row.prize_distribution ?? [],
      scoringRuleSetId: row.scoring_rule_set_id ?? null,
      lineupLockAt: row.lineup_lock_at ? new Date(row.lineup_lock_at) : null,
      maxTeamsPerUser: Number(row.max_teams_per_user ?? 1),
      chainContestId: row.chain_contest_id == null ? null : Number(row.chain_contest_id),
      status: String(row.status ?? 'UPCOMING'),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  private mapEntry(row: any) {
    if (!row) return null;
    return {
      id: String(row.id),
      contestId: String(row.contest_id),
      userId: String(row.user_id),
      fantasyTeamId: String(row.fantasy_team_id),
      entryFeePaid: Number(row.entry_fee_paid ?? 0),
      transactionHash: row.transaction_hash ?? null,
      walletAddress: row.wallet_address ?? null,
      paymentStatus: String(row.payment_status ?? 'SUBSCRIPTION_ACTIVE'),
      totalPoints: Number(row.total_points ?? 0),
      rank: row.rank == null ? null : Number(row.rank),
      prizeWon: row.prize_won == null ? null : Number(row.prize_won),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  async getContest(contestId: string) {
    const result = await this.requirePool().query('SELECT * FROM crickx_contests WHERE id = $1', [contestId]);
    return this.mapContest(result.rows[0] ?? null);
  }

  async getContestWithEntries(contestId: string) {
    const contest = await this.getContest(contestId);
    return contest ? { ...contest, entries: await this.listContestEntries(contestId) } : null;
  }

  async listContestsByFixture(fixtureId: number, activeOnly = false) {
    const condition = activeOnly ? "AND status IN ('UPCOMING', 'LIVE')" : '';
    const result = await this.requirePool().query(
      `SELECT * FROM crickx_contests WHERE sportmonks_fixture_id = $1 ${condition} ORDER BY created_at ASC`,
      [fixtureId],
    );
    return result.rows.map((row) => this.mapContest(row));
  }

  async listStartedActiveContests() {
    const result = await this.requirePool().query(`
      SELECT * FROM crickx_contests
      WHERE status IN ('UPCOMING', 'LIVE')
        AND (lineup_lock_at IS NULL OR lineup_lock_at <= NOW())
      ORDER BY lineup_lock_at ASC NULLS FIRST
      LIMIT 100
    `);
    return result.rows.map((row) => this.mapContest(row));
  }

  async countContestEntries(contestId: string) {
    const result = await this.requirePool().query(
      'SELECT COUNT(*)::int AS count FROM crickx_contest_entries WHERE contest_id = $1',
      [contestId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async listContestEntries(contestId: string, limit?: number) {
    const params: any[] = [contestId];
    const limitSql = limit
      ? ` LIMIT $${params.push(Math.max(1, Math.min(limit, 500)))}`
      : '';
    const result = await this.requirePool().query(
      `SELECT * FROM crickx_contest_entries
       WHERE contest_id = $1
       ORDER BY total_points DESC, created_at ASC, id ASC${limitSql}`,
      params,
    );
    return result.rows.map((row) => this.mapEntry(row));
  }

  async listUserContestEntries(userId: string) {
    const result = await this.requirePool().query(
      'SELECT * FROM crickx_contest_entries WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map((row) => this.mapEntry(row));
  }

  async upsertContestFromRecord(record: any) {
    await this.requirePool().query(
      `INSERT INTO crickx_contests (
        id, sportmonks_fixture_id, name, entry_fee, total_spots, filled_spots, prize_pool_total,
        prize_pool_funding_status, prize_pool_funded_amount, prize_pool_funding_tx_hash,
        prize_pool_funding_at, prize_pool_funding_error, prize_distribution, scoring_rule_set_id,
        lineup_lock_at, max_teams_per_user, chain_contest_id, status, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      )
      ON CONFLICT (id) DO UPDATE SET
        sportmonks_fixture_id = EXCLUDED.sportmonks_fixture_id,
        name = EXCLUDED.name,
        scoring_rule_set_id = EXCLUDED.scoring_rule_set_id,
        lineup_lock_at = EXCLUDED.lineup_lock_at,
        max_teams_per_user = EXCLUDED.max_teams_per_user,
        chain_contest_id = COALESCE(crickx_contests.chain_contest_id, EXCLUDED.chain_contest_id),
        updated_at = NOW()`,
      [
        String(record.id),
        Number(record.sportmonksFixtureId),
        String(record.name ?? 'CrickX Champions Contest'),
        Number(record.entryFee ?? 0),
        record.totalSpots == null ? null : Number(record.totalSpots),
        Number(record.filledSpots ?? 0),
        Number(record.prizePoolTotal ?? 0),
        String(record.prizePoolFundingStatus ?? 'PENDING_MATCH_START'),
        Number(record.prizePoolFundedAmount ?? 0),
        record.prizePoolFundingTxHash ?? null,
        record.prizePoolFundingAt ? new Date(record.prizePoolFundingAt) : null,
        record.prizePoolFundingError ?? null,
        JSON.stringify(record.prizeDistribution ?? []),
        record.scoringRuleSetId ?? null,
        record.lineupLockAt ? new Date(record.lineupLockAt) : null,
        Number(record.maxTeamsPerUser ?? 1),
        Number.isFinite(Number(record.chainContestId)) && Number(record.chainContestId) > 0
          ? Number(record.chainContestId)
          : null,
        String(record.status ?? 'UPCOMING'),
        record.createdAt ? new Date(record.createdAt) : new Date(),
        record.updatedAt ? new Date(record.updatedAt) : new Date(),
      ],
    );
  }

  async joinContest(input: {
    entryId: string;
    contestId: string;
    userId: string;
    fantasyTeamId: string;
    walletAddress: string;
  }) {
    return this.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const contestResult = await client.query(
          'SELECT * FROM crickx_contests WHERE id = $1 FOR UPDATE',
          [input.contestId],
        );
        const contest = contestResult.rows[0];
        if (!contest) throw new PostgresContestError('CONTEST_NOT_FOUND', 'Contest not found in Cloud SQL.');

        if (['COMPLETED', 'CANCELLED'].includes(String(contest.status))) {
          throw new PostgresContestError('CONTEST_CLOSED', 'Contest is already closed.');
        }
        if (contest.lineup_lock_at && new Date(contest.lineup_lock_at).getTime() <= Date.now()) {
          throw new PostgresContestError('CONTEST_STARTED', 'Entries are closed because the match has started.');
        }

        if ((await client.query(
          'SELECT id FROM crickx_contest_entries WHERE contest_id = $1 AND user_id = $2 LIMIT 1',
          [input.contestId, input.userId],
        )).rows[0]) {
          throw new PostgresContestError('ALREADY_JOINED', 'You have already joined this contest.');
        }

        if ((await client.query(
          'SELECT id FROM crickx_contest_entries WHERE contest_id = $1 AND fantasy_team_id = $2 LIMIT 1',
          [input.contestId, input.fantasyTeamId],
        )).rows[0]) {
          throw new PostgresContestError('TEAM_USED', 'This fantasy team has already joined the contest.');
        }

        if ((await client.query(
          'SELECT id FROM crickx_contest_entries WHERE contest_id = $1 AND lower(wallet_address) = lower($2) LIMIT 1',
          [input.contestId, input.walletAddress],
        )).rows[0]) {
          throw new PostgresContestError('WALLET_USED', 'This wallet has already joined the contest.');
        }

        const entryResult = await client.query(
          `INSERT INTO crickx_contest_entries (
            id, contest_id, user_id, fantasy_team_id, entry_fee_paid,
            transaction_hash, wallet_address, payment_status, total_points
          ) VALUES ($1,$2,$3,$4,0,NULL,$5,'SUBSCRIPTION_ACTIVE',0)
          RETURNING *`,
          [input.entryId, input.contestId, input.userId, input.fantasyTeamId, input.walletAddress],
        );

        const nextCount = Number(contest.filled_spots ?? 0) + 1;
        await client.query(
          `UPDATE crickx_contests
           SET filled_spots = $2, prize_pool_total = $3, updated_at = NOW()
           WHERE id = $1`,
          [input.contestId, nextCount, nextCount * 10],
        );

        await client.query(
          `INSERT INTO crickx_contest_wallet_locks (contest_id, wallet_address, user_id)
           VALUES ($1, lower($2), $3)
           ON CONFLICT (contest_id, wallet_address) DO NOTHING`,
          [input.contestId, input.walletAddress, input.userId],
        );

        await client.query('COMMIT');
        return { entry: this.mapEntry(entryResult.rows[0]), participantCount: nextCount };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    });
  }

  async updateContest(contestId: string, patch: Record<string, unknown>) {
    const mapping: Record<string, string> = {
      sportmonksFixtureId: 'sportmonks_fixture_id',
      name: 'name',
      entryFee: 'entry_fee',
      totalSpots: 'total_spots',
      filledSpots: 'filled_spots',
      prizePoolTotal: 'prize_pool_total',
      prizePoolFundingStatus: 'prize_pool_funding_status',
      prizePoolFundedAmount: 'prize_pool_funded_amount',
      prizePoolFundingTxHash: 'prize_pool_funding_tx_hash',
      prizePoolFundingAt: 'prize_pool_funding_at',
      prizePoolFundingError: 'prize_pool_funding_error',
      prizeDistribution: 'prize_distribution',
      scoringRuleSetId: 'scoring_rule_set_id',
      lineupLockAt: 'lineup_lock_at',
      maxTeamsPerUser: 'max_teams_per_user',
      chainContestId: 'chain_contest_id',
      status: 'status',
    };
    const entries = Object.entries(patch).filter(([key, value]) => mapping[key] && value !== undefined);
    if (!entries.length) return this.getContest(contestId);

    const values: any[] = [];
    const sets = entries.map(([key, value]) => {
      let nextValue: any = value;
      if (key === 'prizeDistribution') nextValue = JSON.stringify(value ?? []);
      if (['lineupLockAt', 'prizePoolFundingAt'].includes(key) && value != null) nextValue = new Date(value as any);
      values.push(nextValue);
      return `${mapping[key]} = $${values.length}`;
    });
    values.push(contestId);

    const result = await this.requirePool().query(
      `UPDATE crickx_contests SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new PostgresContestError('CONTEST_NOT_FOUND', 'Contest not found in Cloud SQL.');
    return this.mapContest(result.rows[0]);
  }

  async updateContestEntry(entryId: string, patch: Record<string, unknown>) {
    const mapping: Record<string, string> = {
      entryFeePaid: 'entry_fee_paid',
      transactionHash: 'transaction_hash',
      walletAddress: 'wallet_address',
      paymentStatus: 'payment_status',
      totalPoints: 'total_points',
      rank: 'rank',
      prizeWon: 'prize_won',
    };
    const entries = Object.entries(patch).filter(([key, value]) => mapping[key] && value !== undefined);
    if (!entries.length) {
      const result = await this.requirePool().query('SELECT * FROM crickx_contest_entries WHERE id = $1', [entryId]);
      return this.mapEntry(result.rows[0] ?? null);
    }

    const values: any[] = [];
    const sets = entries.map(([key, value]) => {
      values.push(value);
      return `${mapping[key]} = $${values.length}`;
    });
    values.push(entryId);

    const result = await this.requirePool().query(
      `UPDATE crickx_contest_entries SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new PostgresContestError('ENTRY_NOT_FOUND', 'Contest entry not found in Cloud SQL.');
    return this.mapEntry(result.rows[0]);
  }

  async rankContestEntries(contestId: string) {
    await this.requirePool().query(
      `WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY total_points DESC, created_at ASC, id ASC) AS rank
        FROM crickx_contest_entries WHERE contest_id = $1
      )
      UPDATE crickx_contest_entries e
      SET rank = ranked.rank, updated_at = NOW()
      FROM ranked WHERE e.id = ranked.id`,
      [contestId],
    );
    return this.listContestEntries(contestId);
  }

  async bootstrapFromFirestore(firestore: Firestore, fixtureId?: number) {
    if (!this.isEnabled()) return 0;
    const now = Date.now();
    if (now - this.lastBootstrapAt < this.bootstrapCooldownMs) return 0;
    this.lastBootstrapAt = now;

    try {
      let query: any = firestore.collection('contests')
        .where('status', 'in', ['UPCOMING', 'LIVE'])
        .limit(200);
      if (Number.isFinite(Number(fixtureId))) {
        query = firestore.collection('contests')
          .where('sportmonksFixtureId', '==', Number(fixtureId))
          .limit(20);
      }

      const snapshot = await query.get();
      let synced = 0;

      for (const doc of snapshot.docs) {
        const record = { id: doc.id, ...(doc.data() as any) };
        await this.upsertContestFromRecord(record);

        const existingCount = await this.countContestEntries(record.id);
        if (existingCount === 0) {
          const entriesSnapshot = await firestore.collection('contestEntries')
            .where('contestId', '==', record.id)
            .limit(500)
            .get();

          for (const entryDoc of entriesSnapshot.docs) {
            const entry = { id: entryDoc.id, ...(entryDoc.data() as any) };
            await this.requirePool().query(
              `INSERT INTO crickx_contest_entries (
                id, contest_id, user_id, fantasy_team_id, entry_fee_paid,
                transaction_hash, wallet_address, payment_status, total_points, rank, prize_won,
                created_at, updated_at
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
              ON CONFLICT (id) DO NOTHING`,
              [
                String(entry.id),
                String(entry.contestId),
                String(entry.userId),
                String(entry.fantasyTeamId),
                Number(entry.entryFeePaid ?? 0),
                entry.transactionHash ?? null,
                entry.walletAddress ?? null,
                String(entry.paymentStatus ?? 'SUBSCRIPTION_ACTIVE'),
                Number(entry.totalPoints ?? 0),
                entry.rank == null ? null : Number(entry.rank),
                entry.prizeWon == null ? null : Number(entry.prizeWon),
                entry.createdAt ? new Date(entry.createdAt) : new Date(),
              ],
            );
          }

          const countAfter = await this.countContestEntries(record.id);
          if (countAfter > 0) {
            await this.updateContest(record.id, {
              filledSpots: countAfter,
              prizePoolTotal: countAfter * 10,
            });
          }
        }
        synced++;
      }

      if (synced > 0) {
        this.logger.log(`Cloud SQL bootstrap synchronized ${synced} contest(s) from Firestore.`);
      }
      return synced;
    } catch (error) {
      this.logger.warn(
        `Cloud SQL bootstrap from Firestore failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }
}
