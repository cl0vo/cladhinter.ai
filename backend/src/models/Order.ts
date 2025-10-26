import mongoose from 'mongoose';
import type { Document } from 'mongoose';

const { Schema, model, models } = mongoose;

export type OrderStatus =
  | 'pending'
  | 'pending_verification'
  | 'awaiting_webhook'
  | 'paid'
  | 'failed';

export interface PaymentEvent {
  id: number;
  status: string;
  receivedAt: Date;
  wallet: string;
  amount: number;
}

export interface OrderDocument extends Document {
  _id: string;
  userId: string;
  boostLevel: number;
  tonAmount: number;
  status: OrderStatus;
  payload: string;
  txHash?: string | null;
  txLt?: string | null;
  merchantWallet: string;
  paidAt?: Date | null;
  createdAt: Date;
  verificationAttempts: number;
  verificationError?: string | null;
  lastPaymentCheck?: Date | null;
  lastEvent?: PaymentEvent | null;
}

const paymentEventSchema = new Schema<PaymentEvent>(
  {
    id: { type: Number, required: true },
    status: { type: String, required: true },
    receivedAt: { type: Date, required: true },
    wallet: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDocument>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    boostLevel: { type: Number, required: true },
    tonAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'pending_verification', 'awaiting_webhook', 'paid', 'failed'], default: 'pending' },
    payload: { type: String, required: true },
    txHash: { type: String, default: null },
    txLt: { type: String, default: null },
    merchantWallet: { type: String, required: true },
    paidAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    verificationAttempts: { type: Number, default: 0 },
    verificationError: { type: String, default: null },
    lastPaymentCheck: { type: Date, default: null },
    lastEvent: { type: paymentEventSchema, default: null },
  },
  { collection: 'orders' },
);

orderSchema.index({ userId: 1, createdAt: -1 });

export const OrderModel = models.Order<OrderDocument> ?? model<OrderDocument>('Order', orderSchema);

