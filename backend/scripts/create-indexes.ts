import 'dotenv/config';

import { ensureDatabase, getPool } from '../src/postgres';

async function createSchema() {
  console.info('[db] Ensuring Postgres schema...');
  await ensureDatabase();
  console.info('[db] Schema created successfully');
}

createSchema()
  .catch((error) => {
    console.error('[db] Failed to prepare schema', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch((error: unknown) => {
      console.warn('[db] Failed to close pool', error);
    });
  });
