import { Schema, model, models, type Document } from 'mongoose';

export interface UserDocument extends Document {
  _id: string;
  walletAddress?: string | null;
  countryCode?: string | null;
  energy: number;
  boostLevel: number;
  boostExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  totalEarned: number;
  totalWatches: number;
  sessionCount: number;
  dailyWatchCount: number;
  dailyWatchDate?: string | null;
  claimedPartners: string[];
  lastWatchAt?: Date | null;
}

const userSchema = new Schema<UserDocument>(
  {
    _id: { type: String, required: true },
    walletAddress: { type: String, default: null },
    countryCode: { type: String, default: null },
    energy: { type: Number, default: 0 },
    boostLevel: { type: Number, default: 0 },
    boostExpiresAt: { type: Date, default: null },
    totalEarned: { type: Number, default: 0 },
    totalWatches: { type: Number, default: 0 },
    sessionCount: { type: Number, default: 0 },
    dailyWatchCount: { type: Number, default: 0 },
    dailyWatchDate: { type: String, default: null },
    claimedPartners: { type: [String], default: [] },
    lastWatchAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
);

export const UserModel = models.User<UserDocument> ?? model<UserDocument>('User', userSchema);

