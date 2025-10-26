import mongoose from 'mongoose';
import type { Document } from 'mongoose';

const { Schema, model, models } = mongoose;

export interface SessionDocument extends Document {
  nonceHash: string;
  userId?: string | null;
  wallet?: string | null;
  ttl: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    nonceHash: { type: String, required: true, unique: true },
    userId: { type: String, default: null },
    wallet: { type: String, default: null },
    ttl: { type: Date, required: true },
  },
  {
    collection: 'sessions',
    timestamps: { createdAt: true, updatedAt: false },
  },
);

sessionSchema.index({ ttl: 1 }, { expireAfterSeconds: 0, name: 'sessions_ttl_expire' });

export const SessionModel = models.Session<SessionDocument> ?? model<SessionDocument>('Session', sessionSchema);

