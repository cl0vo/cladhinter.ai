import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';

import { getDatabaseUrl } from './config';

export type SqlExecutor = Pick<Pool, 'query'> | PoolClient;

let pool: Pool | null = null;
let schemaReady = false;

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
      energy DOUBLE PRECISION NOT NULL DEFAULT 0,
      boost_level INTEGER NOT NULL DEFAULT 0,
      boost_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_watch_at TIMESTAMPTZ,
      total_earned DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_watches INTEGER NOT NULL DEFAULT 0,
      session_count INTEGER NOT NULL DEFAULT 0,
      daily_watch_count INTEGER NOT NULL DEFAULT 0,
      daily_watch_date DATE,
      last_session_at TIMESTAMPTZ
    );
  `);

  await executor.query(`
    CREATE TABLE IF NOT EXISTS watch_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ad_id TEXT NOT NULL,
      ad_type TEXT,
      reward DOUBLE PRECISION NOT NULL,
      base_reward DOUBLE PRECISION NOT NULL,
      multiplier DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await executor.query(
    `CREATE INDEX IF NOT EXISTS watch_logs_user_created_idx ON watch_logs (user_id, created_at DESC);`,
  );

  await executor.query(`
    CREATE TABLE IF NOT EXISTS session_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await executor.query(
    `CREATE INDEX IF NOT EXISTS session_logs_user_created_idx ON session_logs (user_id, created_at DESC);`,
  );

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
      payload TEXT NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL,
      tx_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    );
  `);
  await executor.query(
    `CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders (user_id, created_at DESC);`,
  );
}

export async function ensureDatabase(): Promise<void> {
  if (schemaReady) {
    return;
  }

  const currentPool = getPool();
  const client = await currentPool.connect();
  try {
    await runSchemaMigrations(client);
    schemaReady = true;
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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const currentPool = getPool();
  return currentPool.query<T>(text, params);
}

export async function withConnection<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const currentPool = getPool();
  const client = await currentPool.connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
}
