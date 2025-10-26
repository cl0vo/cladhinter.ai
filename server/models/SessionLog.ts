import { Schema, model, models, type Document } from 'mongoose';

export interface SessionLogDocument extends Document {
  userId: string;
  countryCode?: string | null;
  createdAt: Date;
  lastActivityAt: Date;
}

const sessionLogSchema = new Schema<SessionLogDocument>(
  {
    userId: { type: String, required: true, index: true },
    countryCode: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { collection: 'session_logs' },
);

sessionLogSchema.index({ userId: 1, createdAt: -1 });

export const SessionLogModel = models.SessionLog<SessionLogDocument>
  ?? model<SessionLogDocument>('SessionLog', sessionLogSchema);

