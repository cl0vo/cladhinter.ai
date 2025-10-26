import mongoose from 'mongoose';
import type { Document } from 'mongoose';

const { Schema, model, models } = mongoose;

export interface RewardClaimDocument extends Document {
  userId: string;
  partnerId: string;
  reward: number;
  partnerName: string;
  claimedAt: Date;
}

const rewardClaimSchema = new Schema<RewardClaimDocument>(
  {
    userId: { type: String, required: true, index: true },
    partnerId: { type: String, required: true },
    reward: { type: Number, required: true },
    partnerName: { type: String, required: true },
    claimedAt: { type: Date, default: Date.now },
  },
  { collection: 'reward_claims' },
);

rewardClaimSchema.index({ userId: 1, partnerId: 1 }, { unique: true });

export const RewardClaimModel = models.RewardClaim<RewardClaimDocument>
  ?? model<RewardClaimDocument>('RewardClaim', rewardClaimSchema);

