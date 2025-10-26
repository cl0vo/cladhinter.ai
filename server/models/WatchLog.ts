import { Schema, model, models, type Document } from 'mongoose';

export interface WatchLogDocument extends Document {
  userId: string;
  adId: string;
  reward: number;
  baseReward: number;
  multiplier: number;
  countryCode?: string | null;
  createdAt: Date;
}

const watchLogSchema = new Schema<WatchLogDocument>(
  {
    userId: { type: String, required: true, index: true },
    adId: { type: String, required: true },
    reward: { type: Number, required: true },
    baseReward: { type: Number, required: true },
    multiplier: { type: Number, required: true },
    countryCode: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'watch_logs' },
);

watchLogSchema.index({ userId: 1, createdAt: -1 });

export const WatchLogModel = models.WatchLog<WatchLogDocument>
  ?? model<WatchLogDocument>('WatchLog', watchLogSchema);

