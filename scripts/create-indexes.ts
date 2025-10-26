import 'dotenv/config';

import { closeMongoClient, disconnectFromDatabase, getMongoDb } from '../server/mongo';

async function createIndexes() {
  const db = await getMongoDb();

  console.info('[db] Ensuring indexes...');

  const users = db.collection('users');
  await users.createIndex({ wallet: 1 }, { unique: true, sparse: true, name: 'users_wallet_unique' });

  const ledger = db.collection('ledger');
  await ledger.createIndex({ idemKey: 1 }, { unique: true, name: 'ledger_idemKey_unique' });
  await ledger.createIndex({ wallet: 1, createdAt: -1 }, { name: 'ledger_wallet_createdAt' });

  const sessions = db.collection('sessions');
  await sessions.createIndex({ ttl: 1 }, { expireAfterSeconds: 0, name: 'sessions_ttl_expire' });

  console.info('[db] Indexes created successfully');
}

createIndexes()
  .catch((error) => {
    console.error('[db] Failed to create indexes', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([closeMongoClient(), disconnectFromDatabase()]);
  });
