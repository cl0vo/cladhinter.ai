import type {
  AdCompleteResponse,
  ClaimRewardResponse,
  PaymentStatusResponse,
  RewardStatusResponse,
  RetryPaymentResponse,
  UserStatsResponse,
} from '../../types';

const API_BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    ...init,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Request to ${path} failed`;
    throw new Error(message);
  }

  return data as T;
}

export interface InitUserInput {
  userId: string;
  walletAddress?: string | null;
  countryCode?: string | null;
}

export async function initUser(body: InitUserInput): Promise<{ user: {
  id: string;
  energy: number;
  boost_level: number;
  boost_expires_at: string | null;
  country_code: string | null;
} }> {
  return request('/users/init', { body: JSON.stringify(body) });
}

export interface BalanceInput {
  userId: string;
}

export async function getUserBalance(body: BalanceInput): Promise<{
  energy: number;
  boost_level: number;
  multiplier: number;
  boost_expires_at: string | null;
}> {
  return request('/users/balance', { body: JSON.stringify(body) });
}

export interface CompleteAdInput {
  userId: string;
  adId: string;
}

export async function completeAdWatch(body: CompleteAdInput): Promise<AdCompleteResponse> {
  return request('/ads/complete', { body: JSON.stringify(body) });
}

export interface CreateOrderInput {
  userId: string;
  boostLevel: number;
}

export async function createOrder(body: CreateOrderInput): Promise<{
  order_id: string;
  address: string;
  amount: number;
  payload: string;
  boost_name: string;
  duration_days: number;
}> {
  return request('/orders', { body: JSON.stringify(body) });
}

export interface ConfirmOrderInput {
  userId: string;
  orderId: string;
  txHash?: string | null;
}

export async function confirmOrder(body: ConfirmOrderInput): Promise<{
  success: boolean;
  boost_level: number;
  boost_expires_at: string | null;
  multiplier: number;
}> {
  return request('/orders/confirm', { body: JSON.stringify(body) });
}

export interface RegisterTonPaymentInput {
  orderId: string;
  wallet: string;
  amount: number;
  boc: string;
  status?: string;
}

export async function registerTonPayment(body: RegisterTonPaymentInput): Promise<{
  success: boolean;
  order_id: string;
  status: string;
}> {
  return request('/orders/register-payment', { body: JSON.stringify(body) });
}

export interface RetryPaymentInput {
  userId: string;
  orderId: string;
}

export async function retryPayment(body: RetryPaymentInput): Promise<RetryPaymentResponse> {
  return request('/orders/retry-payment', { body: JSON.stringify(body) });
}

export interface PaymentStatusInput {
  userId: string;
  orderId: string;
}

export async function getPaymentStatus(body: PaymentStatusInput): Promise<PaymentStatusResponse> {
  return request('/orders/status', { body: JSON.stringify(body) });
}

export interface StatsInput {
  userId: string;
}

export async function getUserStats(body: StatsInput): Promise<UserStatsResponse> {
  return request('/users/stats', { body: JSON.stringify(body) });
}

export interface RewardStatusInput {
  userId: string;
}

export async function getRewardStatus(body: RewardStatusInput): Promise<RewardStatusResponse> {
  return request('/rewards/status', { body: JSON.stringify(body) });
}

export interface ClaimRewardInput {
  userId: string;
  partnerId: string;
}

export async function claimReward(body: ClaimRewardInput): Promise<ClaimRewardResponse> {
  return request('/rewards/claim', { body: JSON.stringify(body) });
}

export interface CreateUserRequest {
  userId: string;
  walletAddress?: string | null;
  countryCode?: string | null;
}

export async function createUser(body: CreateUserRequest) {
  const response = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Failed to create user';
    throw new Error(message);
  }

  return data as {
    id: string;
    energy: number;
    boost_level: number;
    boost_expires_at: string | null;
    country_code: string | null;
  };
}

export async function listUsersRequest() {
  const response = await fetch(`${API_BASE}/users`, { credentials: 'same-origin' });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Failed to load users';
    throw new Error(message);
  }

  return data as { users: Array<{ id: string; energy: number; boost_level: number; boost_expires_at: string | null; country_code: string | null; created_at: string }> };
}

