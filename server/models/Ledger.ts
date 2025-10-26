import mongoose from 'mongoose';
import type { Document } from 'mongoose';

const { Schema, model, models } = mongoose;

export interface LedgerDocument extends Document {
  userId: string;
  wallet: string;
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  idemKey: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const ledgerSchema = new Schema<LedgerDocument>(
  {
    userId: { type: String, required: true, index: true },
    wallet: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'TON' },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    idemKey: { type: String, required: true, unique: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    collection: 'ledger',
    timestamps: { createdAt: true, updatedAt: false },
  },
);

ledgerSchema.index({ wallet: 1, createdAt: -1 }, { name: 'ledger_wallet_createdAt' });

export const LedgerModel = models.Ledger<LedgerDocument> ?? model<LedgerDocument>('Ledger', ledgerSchema);

