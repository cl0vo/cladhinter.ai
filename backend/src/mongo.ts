import { MongoClient, type Db } from 'mongodb';
import mongoose from 'mongoose';

interface GlobalMongoCache {
  client: MongoClient | null;
  clientPromise: Promise<MongoClient> | null;
  mongoosePromise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoCache: GlobalMongoCache | undefined;
}

const globalCache: GlobalMongoCache = globalThis.__mongoCache ?? {
  client: null,
  clientPromise: null,
  mongoosePromise: null,
};

globalThis.__mongoCache = globalCache;

function requireEnv(name: 'MONGOBASE_MONGODB_URI'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }

  return value;
}

async function createMongoClient(): Promise<MongoClient> {
  const uri = requireEnv('MONGOBASE_MONGODB_URI');

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
  });

  return client.connect();
}

export async function getMongoClient(): Promise<MongoClient> {
  if (globalCache.client) {
    return globalCache.client;
  }

  if (!globalCache.clientPromise) {
    globalCache.clientPromise = createMongoClient();
  }

  globalCache.client = await globalCache.clientPromise;

  return globalCache.client;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();

  return client.db();
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return mongoose;
  }

  if (!globalCache.mongoosePromise) {
    const uri = requireEnv('MONGOBASE_MONGODB_URI');

    globalCache.mongoosePromise = mongoose.connect(uri, {
      maxPoolSize: 10,
    });
  }

  await globalCache.mongoosePromise;

  return mongoose;
}

export async function closeMongoClient(): Promise<void> {
  if (!globalCache.client) {
    return;
  }

  await globalCache.client.close();

  globalCache.client = null;
  globalCache.clientPromise = null;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  globalCache.mongoosePromise = null;
}

