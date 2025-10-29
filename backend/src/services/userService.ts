import { randomUUID } from 'node:crypto';

import { customAlphabet } from 'nanoid';
import type { PoolClient, QueryResultRow } from 'pg';

import { adCreatives } from '@shared/config/ads';
import type { AdCreative } from '@shared/config/ads';
import {
  BOOSTS,
  DAILY_VIEW_LIMIT,
  AD_COOLDOWN_SECONDS,
  ENERGY_PER_AD,
  boostMultiplier,
} from '@shared/config/economy';
import type { Boost } from '@shared/config/economy';
import { getActivePartners, getPartnerById } from '@shared/config/partners';
import type { PartnerReward } from '@shared/config/partners';

import { getMerchantWalletAddress } from '../config';
import { query, withConnection, withTransaction, type SqlExecutor } from '../db';
import { verifyTonTransfer } from './tonService';

const nanoId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 24);

type OrderStatus = 'pending' | 'paid' | 'cancelled';

interface UserRow extends QueryResultRow {
  id: string;
  energy: number;
  boost_level: number;
  boost_expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_watch_at: Date | string | null;
  total_earned: number;
  total_watches: number;
  session_count: number;
  daily_watch_count: number;
  daily_watch_date: Date | string | null;
  last_session_at: Date | string | null;
}

interface OrderRow extends QueryResultRow {
  id: string;
  user_id: string;
  boost_level: number;
  ton_amount: number;
  payload: string;
  address: string;
  status: OrderStatus;
  tx_hash: string | null;
  created_at: Date | string;
  paid_at: Date | string | null;
}

interface OrderSettlementResult {
  boost_level: number;
  boost_expires_at: string | null;
  multiplier: number;
}

interface RewardClaimRow extends QueryResultRow {
  partner_id: string;
}

interface WatchLogRow extends QueryResultRow {
  id: string;
  user_id: string;
  ad_id: string;
  ad_type: string | null;
  reward: number;
  base_reward: number;
  multiplier: number;
  created_at: Date | string;
}

interface UserEntity {
  id: string;
  energy: number;
  boostLevel: number;
  boostExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastWatchAt: Date | null;
  totalEarned: number;
  totalWatches: number;
  sessionCount: number;
  dailyWatchCount: number;
  dailyWatchDate: string | null;
  lastSessionAt: Date | null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

function mapUserRow(row: UserRow): UserEntity {
  return {
    id: row.id,
    energy: Number(row.energy ?? 0),
    boostLevel: Number(row.boost_level ?? 0),
    boostExpiresAt: toDate(row.boost_expires_at),
    createdAt: toDate(row.created_at) ?? new Date(),
    updatedAt: toDate(row.updated_at) ?? new Date(),
    lastWatchAt: toDate(row.last_watch_at),
    totalEarned: Number(row.total_earned ?? 0),
    totalWatches: Number(row.total_watches ?? 0),
    sessionCount: Number(row.session_count ?? 0),
    dailyWatchCount: Number(row.daily_watch_count ?? 0),
    dailyWatchDate: row.daily_watch_date
      ? new Date(row.daily_watch_date).toISOString().slice(0, 10)
      : null,
    lastSessionAt: toDate(row.last_session_at),
  };
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function differenceInSeconds(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 1000);
}

function findBoost(level: number) {
  return BOOSTS.find((item: Boost) => item.level === level) ?? BOOSTS[0];
}

async function fetchUser(executor: SqlExecutor, userId: string, options?: { forUpdate?: boolean }) {
  const suffix = options?.forUpdate ? 'FOR UPDATE' : '';
  const result = await executor.query<UserRow>(`SELECT * FROM users WHERE id = $1 ${suffix}`, [userId]);
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

async function upsertUser(executor: SqlExecutor, userId: string): Promise<UserEntity> {
  const now = new Date();
  const existing = await fetchUser(executor, userId);
  if (existing) {
    return existing;
  }

  const inserted = await executor.query<UserRow>(
    `INSERT INTO users (id, created_at, updated_at)
     VALUES ($1, $2, $2)
     RETURNING *`,
    [userId, now.toISOString()],
  );
  return mapUserRow(inserted.rows[0]);
}

async function settleOrderPayment(
  client: PoolClient,
  order: OrderRow,
  txHash: string | null,
): Promise<OrderSettlementResult> {
  const boost = findBoost(order.boost_level);
  const now = new Date();
  const expiresAt = boost.durationDays
    ? new Date(now.getTime() + boost.durationDays * 24 * 60 * 60 * 1000)
    : null;

  await client.query(
    `UPDATE orders
       SET status = 'paid',
           tx_hash = COALESCE($3, tx_hash),
           paid_at = $2
     WHERE id = $1`,
    [order.id, now.toISOString(), txHash],
  );

  await client.query(
    `UPDATE users
       SET boost_level = $2,
           boost_expires_at = $3,
           updated_at = $4
     WHERE id = $1`,
    [order.user_id, boost.level, expiresAt ? expiresAt.toISOString() : null, now.toISOString()],
  );

  return {
    boost_level: boost.level,
    boost_expires_at: expiresAt ? expiresAt.toISOString() : null,
    multiplier: boostMultiplier(boost.level),
  };
}

function resetDailyCountersIfNeeded(user: UserEntity, now: Date): UserEntity {
  const todayKey = formatDateKey(now);
  if (user.dailyWatchDate !== todayKey) {
    return {
      ...user,
      dailyWatchDate: todayKey,
      dailyWatchCount: 0,
    };
  }
  return user;
}

function ensureAdExists(adId: string): string | null {
  const match = adCreatives.find((ad: AdCreative) => ad.id === adId);
  return match?.type ?? null;
}

function resolveAdBaseReward(adType: string | null | undefined): number {
  if (!adType) {
    return ENERGY_PER_AD.short;
  }
  const lower = adType.trim().toLowerCase();
  if (lower in ENERGY_PER_AD) {
    return ENERGY_PER_AD[lower as keyof typeof ENERGY_PER_AD];
  }
  return ENERGY_PER_AD.short;
}

export async function initUser(userId: string): Promise<{
  user: {
    id: string;
    energy: number;
    boost_level: number;
    boost_expires_at: string | null;
  };
}> {
  const now = new Date();
  const user = await withTransaction(async (client) => {
    let entity = await upsertUser(client, userId);

    const boostExpired =
      entity.boostExpiresAt && entity.boostExpiresAt.getTime() < now.getTime();

    if (boostExpired) {
      const updated = await client.query<UserRow>(
        `UPDATE users
         SET boost_level = 0,
             boost_expires_at = NULL,
             updated_at = $2
         WHERE id = $1
         RETURNING *`,
        [userId, now.toISOString()],
      );
      entity = mapUserRow(updated.rows[0]);
    }

    await client.query(
      `INSERT INTO session_logs (id, user_id, created_at)
       VALUES ($1, $2, $3)`,
      [randomUUID(), userId, now.toISOString()],
    );

    await client.query(
      `UPDATE users
         SET session_count = session_count + 1,
             last_session_at = $2,
             updated_at = $2
       WHERE id = $1`,
      [userId, now.toISOString()],
    );

    return entity;
  });

  return {
    user: {
      id: user.id,
      energy: user.energy,
      boost_level: user.boostLevel,
      boost_expires_at: user.boostExpiresAt ? user.boostExpiresAt.toISOString() : null,
    },
  };
}

export async function getUserBalance(userId: string) {
  const user = await withConnection(async (client) => upsertUser(client, userId));
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
  adType,
}: {
  userId: string;
  adId: string;
  adType?: string | null;
}) {
  if (!adId || !adId.trim()) {
    throw new Error('Missing ad_id');
  }

  const now = new Date();
  const resolvedType = adType ?? ensureAdExists(adId);
  const baseReward = resolveAdBaseReward(resolvedType);

  return withTransaction(async (client) => {
    let user = await fetchUser(client, userId, { forUpdate: true });
    if (!user) {
      user = await upsertUser(client, userId);
    }

    user = resetDailyCountersIfNeeded(user, now);

    if (user.lastWatchAt) {
      const seconds = differenceInSeconds(now, user.lastWatchAt);
      if (seconds < AD_COOLDOWN_SECONDS) {
        throw new Error(`Cooldown active. Try again in ${AD_COOLDOWN_SECONDS - seconds} seconds.`);
      }
    }

    if (user.dailyWatchCount >= DAILY_VIEW_LIMIT) {
      throw new Error('Daily limit reached');
    }

    const multiplier = boostMultiplier(user.boostLevel);
    const reward = baseReward * multiplier;
    const todayKey = formatDateKey(now);

    const updated = await client.query<UserRow>(
      `UPDATE users
         SET energy = energy + $2,
             total_earned = total_earned + $2,
             total_watches = total_watches + 1,
             daily_watch_count = $3,
             daily_watch_date = $4::date,
             last_watch_at = $5,
             updated_at = $5
       WHERE id = $1
       RETURNING *`,
      [
        userId,
        reward,
        user.dailyWatchCount + 1,
        todayKey,
        now.toISOString(),
      ],
    );

    const updatedUser = mapUserRow(updated.rows[0]);

    await client.query(
      `INSERT INTO watch_logs (id, user_id, ad_id, ad_type, reward, base_reward, multiplier, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        userId,
        adId,
        resolvedType,
        reward,
        baseReward,
        multiplier,
        now.toISOString(),
      ],
    );

    const remaining = Math.max(0, DAILY_VIEW_LIMIT - updatedUser.dailyWatchCount);

    return {
      success: true,
      reward,
      new_balance: updatedUser.energy,
      multiplier,
      daily_watches_remaining: remaining,
    };
  });
}

export async function getUserStats(userId: string) {
  const user = await withConnection(async (client) => upsertUser(client, userId));

  const [recentWatches, claimedRewardsCount] = await Promise.all([
    query<WatchLogRow>(
      `SELECT * FROM watch_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId],
    ),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM reward_claims WHERE user_id = $1`, [
      userId,
    ]),
  ]);

  const todayKey = formatDateKey(new Date());
  const todayWatches = user.dailyWatchDate === todayKey ? user.dailyWatchCount : 0;

  return {
    total_energy: user.energy,
    total_watches: user.totalWatches,
    total_earned: user.totalEarned,
    total_sessions: user.sessionCount,
    today_watches: todayWatches,
    daily_limit: DAILY_VIEW_LIMIT,
    boost_level: user.boostLevel,
    multiplier: boostMultiplier(user.boostLevel),
    boost_expires_at: user.boostExpiresAt ? user.boostExpiresAt.toISOString() : null,
    reward_claims: Number(claimedRewardsCount.rows[0]?.count ?? '0'),
    watch_history: recentWatches.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      ad_id: row.ad_id,
      reward: row.reward,
      base_reward: row.base_reward,
      multiplier: row.multiplier,
      created_at: new Date(row.created_at).toISOString(),
    })),
  };
}

export async function createOrder({
  userId,
  boostLevel,
}: {
  userId: string;
  boostLevel: number;
}) {
  const boost = findBoost(boostLevel);
  if (!boost || boost.costTon <= 0) {
    throw new Error('Selected boost is not purchasable');
  }

  const orderId = nanoId();
  const payload = nanoId();
  const walletAddress = getMerchantWalletAddress();

  await query(
    `INSERT INTO orders (id, user_id, boost_level, ton_amount, payload, address, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [orderId, userId, boost.level, boost.costTon, payload, walletAddress, 'pending'],
  );

  return {
    order_id: orderId,
    address: walletAddress,
    amount: boost.costTon,
    payload,
    boost_name: boost.name,
    duration_days: boost.durationDays ?? null,
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
  if (!orderId) {
    throw new Error('Missing order_id');
  }

  return withTransaction(async (client) => {
    const orderResult = await client.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [orderId, userId],
    );
    const row = orderResult.rows[0];
    if (!row) {
      throw new Error('Order not found');
    }
    if (row.status === 'paid') {
      return {
        success: true,
        boost_level: row.boost_level,
        boost_expires_at: row.paid_at ? new Date(row.paid_at).toISOString() : null,
        multiplier: boostMultiplier(row.boost_level),
      };
    }

    if (txHash) {
      const verified = await verifyTonTransfer({
        txHash,
        amountTon: row.ton_amount,
        destination: row.address,
      });
      if (!verified) {
        throw new Error('TON transfer not verified');
      }
    }

    const settlement = await settleOrderPayment(client, row, txHash ?? null);
    return {
      success: true,
      ...settlement,
    };
  });
}

export async function registerTonWebhookPayment({
  orderId,
  txHash,
  amountTon,
}: {
  orderId: string;
  txHash: string;
  amountTon?: number;
}) {
  return withTransaction(async (client) => {
    const orderResult = await client.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    );
    const row = orderResult.rows[0];
    if (!row) {
      throw new Error('Order not found');
    }

    if (row.status === 'paid') {
      return {
        success: true,
        boost_level: row.boost_level,
        boost_expires_at: row.paid_at ? new Date(row.paid_at).toISOString() : null,
        multiplier: boostMultiplier(row.boost_level),
      };
    }

    const verified = await verifyTonTransfer({
      txHash,
      amountTon: amountTon ?? row.ton_amount,
      destination: row.address,
    });

    if (!verified) {
      throw new Error('TON transfer not verified');
    }

    const settlement = await settleOrderPayment(client, row, txHash);
    return {
      success: true,
      ...settlement,
    };
  });
}

export async function getRewardStatus(userId: string) {
  const result = await query<RewardClaimRow>(
    `SELECT partner_id FROM reward_claims WHERE user_id = $1`,
    [userId],
  );
  const claimed = result.rows.map((row) => row.partner_id);
  const available = getActivePartners().filter(
    (partner: PartnerReward) => !claimed.includes(partner.id),
  ).length;

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

  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT 1 FROM reward_claims WHERE user_id = $1 AND partner_id = $2`,
      [userId, partnerId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error('Reward already claimed');
    }

    const now = new Date();

    const updated = await client.query<UserRow>(
      `UPDATE users
         SET energy = energy + $2,
             total_earned = total_earned + $2,
             updated_at = $3
       WHERE id = $1
       RETURNING *`,
      [userId, partner.reward, now.toISOString()],
    );

    await client.query(
      `INSERT INTO reward_claims (id, user_id, partner_id, reward, partner_name, claimed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [randomUUID(), userId, partnerId, partner.reward, partner.name],
    );

    const energy = Number(updated.rows[0]?.energy ?? partner.reward);

    return {
      success: true,
      reward: partner.reward,
      new_balance: energy,
      partner_name: partner.name,
    };
  });
}
