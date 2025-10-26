import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

export type SqlExecutor = Pick<Pool, 'query'> | PoolClient;

let pool: Pool | null = null;
let schemaInitialized = false;

function getDatabaseUrl(): string {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL_NO_SSL,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  throw new Error('Missing DATABASE_URL environment variable');
}

function createPool(): Pool {
  const connectionString = getDatabaseUrl();
  const useSsl = connectionString.includes('sslmode=require');
  return new Pool({
    connectionString,
    max: 10,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

async function runSchemaMigrations(executor: SqlExecutor): Promise<void> {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      wallet TEXT,
      wallet_address TEXT,
      wallet_verified BOOLEAN NOT NULL DEFAULT FALSE,
      country_code TEXT,
      energy DOUBLE PRECISION NOT NULL DEFAULT 0,
      boost_level INTEGER NOT NULL DEFAULT 0,
      boost_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      total_earned DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_watches INTEGER NOT NULL DEFAULT 0,
      session_count INTEGER NOT NULL DEFAULT 0,
      daily_watch_count INTEGER NOT NULL DEFAULT 0,
      daily_watch_date TEXT,
      claimed_partners TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      last_watch_at TIMESTAMPTZ
    );
  `);

  await executor.query(`
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wallet TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TON',
      type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
      idem_key TEXT NOT NULL UNIQUE,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await executor.query(`CREATE INDEX IF NOT EXISTS ledger_user_created_at_idx ON ledger (user_id, created_at DESC);`);
  await executor.query(`CREATE INDEX IF NOT EXISTS ledger_wallet_created_at_idx ON ledger (wallet, created_at DESC);`);

  await executor.query(`
    CREATE TABLE IF NOT EXISTS watch_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ad_id TEXT NOT NULL,
      reward DOUBLE PRECISION NOT NULL,
      base_reward DOUBLE PRECISION NOT NULL,
      multiplier DOUBLE PRECISION NOT NULL,
      country_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await executor.query(`CREATE INDEX IF NOT EXISTS watch_logs_user_created_at_idx ON watch_logs (user_id, created_at DESC);`);

  await executor.query(`
    CREATE TABLE IF NOT EXISTS session_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      country_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await executor.query(`CREATE INDEX IF NOT EXISTS session_logs_user_created_at_idx ON session_logs (user_id, created_at DESC);`);

  await executor.query(`
    CREATE TABLE IF NOT EXISTS reward_claims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      partner_id TEXT NOT NULL,
      reward DOUBLE PRECISION NOT NULL,
      partner_name TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, partner_id)
    );
  `);

  await executor.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      boost_level INTEGER NOT NULL,
      ton_amount DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      tx_hash TEXT,
      tx_lt TEXT,
      merchant_wallet TEXT NOT NULL,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      verification_attempts INTEGER NOT NULL DEFAULT 0,
      verification_error TEXT,
      last_payment_check TIMESTAMPTZ,
      last_event JSONB
    );
  `);
  await executor.query(`CREATE INDEX IF NOT EXISTS orders_user_created_at_idx ON orders (user_id, created_at DESC);`);

  await executor.query(`
    CREATE TABLE IF NOT EXISTS wallet_sessions (
      nonce_hash TEXT PRIMARY KEY,
      user_id TEXT,
      wallet TEXT,
      ttl TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function ensureDatabase(): Promise<void> {
  if (schemaInitialized) {
    return;
  }

  const currentPool = getPool();
  const client = await currentPool.connect();
  try {
    await runSchemaMigrations(client);
    schemaInitialized = true;
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const currentPool = getPool();
  const client = await currentPool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  const currentPool = getPool();
  return currentPool.query<T>(text, params);
}

export function getExecutor(client?: PoolClient): SqlExecutor {
  return client ?? getPool();
}

