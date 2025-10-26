import { randomUUID } from 'node:crypto';

import { BOOSTS, DAILY_VIEW_LIMIT, ENERGY_PER_AD, boostMultiplier } from '../../config/economy';
import { adCreatives } from '../../config/ads';
import { getActivePartners, getPartnerById } from '../../config/partners';
import { LedgerModel } from '../models/Ledger';
import { UserModel } from '../models/User';
import { WatchLogModel } from '../models/WatchLog';
import { SessionLogModel } from '../models/SessionLog';
import { OrderModel, type OrderStatus } from '../models/Order';
import { RewardClaimModel } from '../models/RewardClaim';
import { LedgerModel } from '../models/Ledger';

function ensureEntityExists<T>(entity: T | null | undefined, identifier: string): asserts entity is T {
  if (!entity) {
    throw new Error(`${identifier} not found`);
  }
}

function resolveUserWallet(
  user: { wallet?: string | null; walletAddress?: string | null } | null | undefined,
  fallback?: string | null,
): string {
  return user?.wallet ?? user?.walletAddress ?? fallback ?? '';
}

async function recordLedgerEntry({
  userId,
  wallet,
  amount,
  type,
  metadata,
  idemKey,
}: {
  userId: string;
  wallet: string | null | undefined;
  amount: number;
  type: 'credit' | 'debit';
  metadata?: Record<string, unknown> | null;
  idemKey: string;
}) {
  await LedgerModel.create({
    userId,
    wallet: wallet ?? '',
    amount,
    type,
    idemKey,
    metadata: metadata ?? null,
  });
}

function getAdBaseReward(adId: string): number {
  const creative = adCreatives.find((ad) => ad.id === adId);

  if (!creative) {
    return ENERGY_PER_AD.short;
  }

  if (creative.type === 'video') {
    return ENERGY_PER_AD.long;
  }

  return ENERGY_PER_AD.short;
}

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function resolveBoost(level: number) {
  const boost = BOOSTS.find((item) => item.level === level);
  if (!boost) {
    throw new Error(`Unknown boost level: ${level}`);
  }
  return boost;
}

export async function initUser({
  userId,
  walletAddress,
  countryCode,
}: {
  userId: string;
  walletAddress?: string | null;
  countryCode?: string | null;
}) {
  let user = await UserModel.findById(userId);

  const now = new Date();
  if (!user) {
    user = await UserModel.create({
      _id: userId,
      wallet: walletAddress ?? null,
      walletAddress: walletAddress ?? null,
      walletVerified: false,
      countryCode: countryCode ?? null,
      energy: 0,
      boostLevel: 0,
      lastSeenAt: now,
    });
  } else {
    if (walletAddress && !user.wallet) {
      user.wallet = walletAddress;
      user.walletAddress = walletAddress;
    }
    user.countryCode = countryCode ?? user.countryCode ?? null;
    user.lastSeenAt = now;
  }

  user.sessionCount += 1;
  await user.save();

  await SessionLogModel.create({
    userId,
    countryCode: user.countryCode ?? null,
  });

  return {
    user: {
      id: user._id,
      energy: user.energy,
      boost_level: user.boostLevel,
      boost_expires_at: user.boostExpiresAt ? user.boostExpiresAt.toISOString() : null,
      country_code: user.countryCode ?? null,
    },
  };
}

export async function getUserBalance({
  userId,
}: {
  userId: string;
}) {
  const user = await UserModel.findById(userId);
  ensureEntityExists(user, `User ${userId}`);

  return {
    energy: user.energy,
    boost_level: user.boostLevel,
    multiplier: boostMultiplier(user.boostLevel),
    boost_expires_at: user.boostExpiresAt ? user.boostExpiresAt.toISOString() : null,
  };
}

export async function completeAdWatch({
  userId,
  adId,
}: {
  userId: string;
  adId: string;
}) {
  const user = await UserModel.findById(userId);
  ensureEntityExists(user, `User ${userId}`);

  const now = new Date();
  const today = todayKey(now);

  if (user.dailyWatchDate !== today) {
    user.dailyWatchDate = today;
    user.dailyWatchCount = 0;
  }

  if (user.dailyWatchCount >= DAILY_VIEW_LIMIT) {
    throw new Error('Daily ad limit reached');
  }

  const baseReward = getAdBaseReward(adId);
  const multiplier = boostMultiplier(user.boostLevel);
  const reward = Math.round(baseReward * multiplier * 100) / 100;

  user.energy += reward;
  user.totalEarned += reward;
  user.totalWatches += 1;
  user.dailyWatchCount += 1;
  user.lastWatchAt = now;

  await user.save();

  const watchLog = await WatchLogModel.create({
    userId,
    adId,
    reward,
    baseReward,
    multiplier,
    countryCode: user.countryCode ?? null,
  });

  await recordLedgerEntry({
    userId,
    wallet: resolveUserWallet(user),
    amount: reward,
    type: 'credit',
    metadata: {
      adId,
      watchLogId: String(watchLog._id),
    },
    idemKey: `ad:${String(watchLog._id)}`,
  });

  const dailyRemaining = Math.max(DAILY_VIEW_LIMIT - user.dailyWatchCount, 0);

  return {
    success: true,
    reward,
    new_balance: user.energy,
    multiplier,
    daily_watches_remaining: dailyRemaining,
  };
}

function createPayload(): string {
  return Buffer.from(randomUUID()).toString('base64url');
}

const DEFAULT_MERCHANT = 'UQDw8GgIlOX7SqLJKkpIB2JaOlU5n0g2qGifwtneUb1VMnVt';

export async function createOrder({
  userId,
  boostLevel,
}: {
  userId: string;
  boostLevel: number;
}) {
  const user = await UserModel.findById(userId);
  ensureEntityExists(user, `User ${userId}`);

  const boost = resolveBoost(boostLevel);
  const orderId = randomUUID();

  const order = await OrderModel.create({
    _id: orderId,
    userId,
    boostLevel,
    tonAmount: boost.costTon,
    status: 'pending',
    payload: createPayload(),
    merchantWallet: DEFAULT_MERCHANT,
  });

  return {
    order_id: order._id,
    address: order.merchantWallet,
    amount: order.tonAmount,
    payload: order.payload,
    boost_name: boost.name,
    duration_days: boost.durationDays ?? 0,
  };
}

export async function confirmOrder({
  userId,
  orderId,
  txHash,
}: {
  userId: string;
  orderId: string;
  txHash?: string | null;
}) {
  const order = await OrderModel.findById(orderId);
  ensureEntityExists(order, `Order ${orderId}`);

  if (order.userId !== userId) {
    throw new Error('Order does not belong to user');
  }

  const user = await UserModel.findById(userId);
  ensureEntityExists(user, `User ${userId}`);

  const boost = resolveBoost(order.boostLevel);

  order.status = 'paid';
  order.txHash = txHash ?? order.txHash ?? null;
  order.paidAt = new Date();
  order.lastPaymentCheck = new Date();

  await order.save();

  user.boostLevel = Math.max(user.boostLevel, order.boostLevel);

  if (boost.durationDays) {
    const expires = new Date();
    expires.setUTCDate(expires.getUTCDate() + boost.durationDays);
    user.boostExpiresAt = expires;
  }

  await user.save();

  await recordLedgerEntry({
    userId,
    wallet: resolveUserWallet(user),
    amount: order.tonAmount,
    type: 'debit',
    metadata: {
      orderId: order._id,
      txHash: order.txHash ?? null,
      boostLevel: order.boostLevel,
    },
    idemKey: `order:confirm:${order._id}`,
  });

  return {
    success: true,
    boost_level: user.boostLevel,
    boost_expires_at: user.boostExpiresAt ? user.boostExpiresAt.toISOString() : null,
    multiplier: boostMultiplier(user.boostLevel),
  };
}

export async function registerTonPayment({
  orderId,
  wallet,
  amount,
  boc,
  status,
}: {
  orderId: string;
  wallet: string;
  amount: number;
  boc: string;
  status?: OrderStatus;
}) {
  const order = await OrderModel.findById(orderId);
  ensureEntityExists(order, `Order ${orderId}`);

  order.status = status ?? 'pending_verification';
  order.lastPaymentCheck = new Date();
  order.verificationAttempts += 1;
  order.lastEvent = {
    id: Date.now(),
    status: 'submitted',
    receivedAt: new Date(),
    wallet,
    amount,
  };
  order.verificationError = null;

  await order.save();

  const user = await UserModel.findById(order.userId);

  await recordLedgerEntry({
    userId: order.userId,
    wallet: resolveUserWallet(user, wallet),
    amount,
    type: 'debit',
    metadata: {
      orderId: order._id,
      boc,
      status: order.status,
    },
    idemKey: `order:payment:${order._id}:${order.verificationAttempts}`,
  });

  return {
    success: true,
    order_id: order._id,
    status: order.status,
  };
}

export async function retryPayment({
  userId,
  orderId,
}: {
  userId: string;
  orderId: string;
}) {
  const order = await OrderModel.findById(orderId);
  ensureEntityExists(order, `Order ${orderId}`);

  if (order.userId !== userId) {
    throw new Error('Order does not belong to user');
  }

  order.verificationAttempts += 1;
  order.lastPaymentCheck = new Date();

  await order.save();

  return {
    success: true,
    status: order.status,
    verification_attempts: order.verificationAttempts,
    last_payment_check: order.lastPaymentCheck?.toISOString() ?? null,
  };
}

export async function getPaymentStatus({
  userId,
  orderId,
}: {
  userId: string;
  orderId: string;
}) {
  const order = await OrderModel.findById(orderId);
  ensureEntityExists(order, `Order ${orderId}`);

  if (order.userId !== userId) {
    throw new Error('Order does not belong to user');
  }

  return {
    order_id: order._id,
    status: order.status,
    paid_at: order.paidAt ? order.paidAt.toISOString() : null,
    tx_hash: order.txHash ?? null,
    tx_lt: order.txLt ?? null,
    verification_attempts: order.verificationAttempts,
    verification_error: order.verificationError ?? null,
    last_payment_check: order.lastPaymentCheck ? order.lastPaymentCheck.toISOString() : null,
    last_event: order.lastEvent
      ? {
          id: order.lastEvent.id,
          status: order.lastEvent.status,
          received_at: order.lastEvent.receivedAt.toISOString(),
          wallet: order.lastEvent.wallet,
          amount: order.lastEvent.amount,
        }
      : undefined,
  };
}

export async function getUserStats({
  userId,
}: {
  userId: string;
}) {
  const user = await UserModel.findById(userId);
  ensureEntityExists(user, `User ${userId}`);

  const [watchHistory, todayCount, sessions, totalEarned] = await Promise.all([
    WatchLogModel.find({ userId }).sort({ createdAt: -1 }).limit(25).lean(),
    WatchLogModel.countDocuments({
      userId,
      createdAt: { $gte: new Date(todayKey()) },
    }),
    SessionLogModel.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    WatchLogModel.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: '$reward' } } },
    ]),
  ]);

  const totalEarnedValue = totalEarned[0]?.total ?? 0;

  return {
    totals: {
      energy: user.energy,
      watches: user.totalWatches,
      earned: totalEarnedValue,
      sessions: user.sessionCount,
      today_watches: todayCount,
      daily_limit: DAILY_VIEW_LIMIT,
    },
    boost: {
      level: user.boostLevel,
      multiplier: boostMultiplier(user.boostLevel),
      expires_at: user.boostExpiresAt ? user.boostExpiresAt.toISOString() : null,
    },
    country_code: user.countryCode ?? null,
    watch_history: watchHistory.map((item) => ({
      id: String(item._id),
      user_id: userId,
      ad_id: item.adId,
      reward: item.reward,
      base_reward: item.baseReward,
      multiplier: item.multiplier,
      created_at: item.createdAt.toISOString(),
      country_code: item.countryCode ?? null,
    })),
    session_history: sessions.map((session) => ({
      id: String(session._id),
      user_id: userId,
      country_code: session.countryCode ?? null,
      created_at: session.createdAt.toISOString(),
      last_activity_at: session.lastActivityAt.toISOString(),
    })),
  };
}

export async function getRewardStatus({
  userId,
}: {
  userId: string;
}) {
  const user = await UserModel.findById(userId);
  ensureEntityExists(user, `User ${userId}`);

  const claimed = user.claimedPartners;
  const available = getActivePartners().filter((partner) => !claimed.includes(partner.id)).length;

  return {
    claimed_partners: claimed,
    available_rewards: available,
  };
}

export async function claimReward({
  userId,
  partnerId,
}: {
  userId: string;
  partnerId: string;
}) {
  const partner = getPartnerById(partnerId);

  if (!partner || !partner.active) {
    throw new Error('Partner reward is unavailable');
  }

  const user = await UserModel.findById(userId);
  ensureEntityExists(user, `User ${userId}`);

  if (user.claimedPartners.includes(partnerId)) {
    throw new Error('Reward already claimed');
  }

  user.claimedPartners.push(partnerId);
  user.energy += partner.reward;
  user.totalEarned += partner.reward;

  await user.save();

  const rewardClaim = await RewardClaimModel.create({
    userId,
    partnerId,
    reward: partner.reward,
    partnerName: partner.name,
  });

  await recordLedgerEntry({
    userId,
    wallet: resolveUserWallet(user),
    amount: partner.reward,
    type: 'credit',
    metadata: {
      partnerId,
      partnerName: partner.name,
      rewardClaimId: String(rewardClaim._id),
    },
    idemKey: `reward:${String(rewardClaim._id)}`,
  });

  return {
    success: true,
    reward: partner.reward,
    new_balance: user.energy,
    partner_name: partner.name,
  };
}

export async function getLedgerHistory({
  userId,
  page = 1,
  limit = 20,
}: {
  userId: string;
  page?: number;
  limit?: number;
}) {
  const user = await UserModel.findById(userId);
  ensureEntityExists(user, `User ${userId}`);

  const requestedPage = Number(page);
  const requestedLimit = Number(limit);
  const normalizedPage = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const normalizedLimit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 20;
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [entries, total] = await Promise.all([
    LedgerModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit)
      .lean(),
    LedgerModel.countDocuments({ userId }),
  ]);

  return {
    entries: entries.map((entry) => ({
      id: String(entry._id),
      user_id: entry.userId,
      wallet: entry.wallet,
      amount: entry.amount,
      currency: entry.currency,
      type: entry.type,
      metadata: entry.metadata ?? null,
      created_at: entry.createdAt.toISOString(),
    })),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      has_next: skip + entries.length < total,
    },
  };
}

