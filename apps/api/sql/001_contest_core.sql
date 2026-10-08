-- Cloud SQL PostgreSQL schema for CrickX contest financial state.
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
CREATE INDEX IF NOT EXISTS crickx_contest_entries_contest_rank_idx ON crickx_contest_entries (contest_id, total_points DESC, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS crickx_contest_entries_wallet_idx ON crickx_contest_entries (contest_id, lower(wallet_address)) WHERE wallet_address IS NOT NULL;
CREATE TABLE IF NOT EXISTS crickx_contest_wallet_locks (
  contest_id TEXT NOT NULL REFERENCES crickx_contests(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contest_id, wallet_address)
);
CREATE INDEX IF NOT EXISTS crickx_contest_wallet_locks_user_idx ON crickx_contest_wallet_locks (contest_id, user_id);
