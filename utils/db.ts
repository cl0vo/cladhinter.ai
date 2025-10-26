import mongoose from 'mongoose';

interface GlobalMongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: GlobalMongooseCache | undefined;
}

const globalCache = globalThis.__mongooseCache ?? { conn: null, promise: null };

globalThis.__mongooseCache = globalCache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (globalCache.conn) {
    return globalCache.conn;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable');
  }

  if (!globalCache.promise) {
    globalCache.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
    });
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}

export function getDatabaseConnection(): typeof mongoose | null {
  return globalCache.conn;
}

