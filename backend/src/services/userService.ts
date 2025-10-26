import { randomUUID } from 'node:crypto';

import { BOOSTS, DAILY_VIEW_LIMIT, ENERGY_PER_AD, boostMultiplier } from '../../../shared/config/economy';
import { adCreatives } from '../../../shared/config/ads';
import { getActivePartners, getPartnerById } from '../../../shared/config/partners';
import { getExecutor, query, withTransaction, type SqlExecutor } from '../postgres';

export type OrderStatus =
  | 'pending'
  | 'pending_verification'
  | 'awaiting_webhook'
  | 'paid'
  | 'failed';

interface UserRow {
  id: string;
  wallet: string | null;
  wallet_address: string | null;
  wallet_verified: boolean;
  country_code: string | null;
  energy: number;
  boost_level: number;
  boost_expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_seen_at: Date | string;
  total_earned: number;
  total_watches: number;
  session_count: number;
  daily_watch_count: number;
  daily_watch_date: string | null;
  claimed_partners: string[] | null;
  last_watch_at: Date | string | null;
}

interface OrderRow {
  id: string;
  user_id: string;
  boost_level: number;
  ton_amount: number;
  status: OrderStatus;
  payload: string;
  tx_hash: string | null;
  tx_lt: string | null;
  merchant_wallet: string;
  paid_at: Date | string | null;
  created_at: Date | string;
  verification_attempts: number;
  verification_error: string | null;
  last_payment_check: Date | string | null;
  last_event: unknown | null;
}

interface WatchLogRow {
  id: string;
  user_id: string;
  ad_id: string;
  reward: number;
  base_reward: number;
  multiplier: number;
  country_code: string | null;
  created_at: Date | string;
}

interface SessionLogRow {
  id: string;
  user_id: string;
  country_code: string | null;
  created_at: Date | string;
  last_activity_at: Date | string;
}

interface LedgerRow {
  id: string;
  user_id: string;
  wallet: string;
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
}

interface PaymentEvent {
  id: number;
  status: string;
  receivedAt: string;
  wallet: string;
  amount: number;
}

interface UserEntity {
  id: string;
  wallet: string | null;
  walletAddress: string | null;
  walletVerified: boolean;
  countryCode: string | null;
  energy: number;
  boostLevel: number;
  boostExpiresAt: Date | null;
  lastSeenAt: Date;
  totalEarned: number;
  totalWatches: number;
  sessionCount: number;
  dailyWatchCount: number;
  dailyWatchDate: string | null;
  claimedPartners: string[];
  lastWatchAt: Date | null;
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
    wallet: row.wallet,
    walletAddress: row.wallet_address,
    walletVerified: row.wallet_verified,
    countryCode: row.country_code,
    energy: Number(row.energy ?? 0),
    boostLevel: Number(row.boost_level ?? 0),
    boostExpiresAt: toDate(row.boost_expires_at),
    lastSeenAt: toDate(row.last_seen_at) ?? new Date(),
    totalEarned: Number(row.total_earned ?? 0),
    totalWatches: Number(row.total_watches ?? 0),
    sessionCount: Number(row.session_count ?? 0),
    dailyWatchCount: Number(row.daily_watch_count ?? 0),
    dailyWatchDate: row.daily_watch_date,
    claimedPartners: row.claimed_partners ?? [],
    lastWatchAt: toDate(row.last_watch_at),
  };
}

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

async function fetchUserById(executor: SqlExecutor, userId: string, options: { forUpdate?: boolean } = {}): Promise<UserEntity | null> {
  const suffix = options.forUpdate ? ' FOR UPDATE' : '';
  const result = await executor.query<UserRow>(`SELECT * FROM users WHERE id = $1${suffix}`, [userId]);
  if (result.rows.length === 0) {
    return null;
  }
  return mapUserRow(result.rows[0]);
}

async function fetchOrderById(executor: SqlExecutor, orderId: string, options: { forUpdate?: boolean } = {}): Promise<OrderRow | null> {
  const suffix = options.forUpdate ? ' FOR UPDATE' : '';
  const result = await executor.query<OrderRow>(`SELECT * FROM orders WHERE id = $1${suffix}`, [orderId]);
  return result.rows[0] ?? null;
}

async function recordLedgerEntry(
  executor: SqlExecutor,
  {
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
  },
): Promise<void> {
  await executor.query(
    `INSERT INTO ledger (id, user_id, wallet, amount, type, metadata, idem_key)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      randomUUID(),
      userId,
      wallet ?? '',
      amount,
      type,
      metadata ? JSON.stringify(metadata) : null,
      idemKey,
    ],
  );
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
  return withTransaction(async (client) => {
    const now = new Date();
    const wallet = walletAddress ?? null;

    let user = await fetchUserById(client, userId, { forUpdate: true });

    if (!user) {
      const result = await client.query<UserRow>(
        `INSERT INTO users (
           id, wallet, wallet_address, wallet_verified, country_code, energy, boost_level, boost_expires_at,
           created_at, updated_at, last_seen_at, total_earned, total_watches, session_count, daily_watch_count,
           daily_watch_date, claimed_partners, last_watch_at
         )
         VALUES ($1, $2, $2, FALSE, $3, 0, 0, NULL, $4, $4, $4, 0, 0, 1, 0, NULL, ARRAY[]::TEXT[], NULL)
         RETURNING *`,
        [userId, wallet, countryCode ?? null, now.toISOString()],
      );
      user = mapUserRow(result.rows[0]);
    } else {
      const result = await client.query<UserRow>(
        `UPDATE users
           SET wallet = CASE WHEN wallet IS NULL AND $2 IS NOT NULL THEN $2 ELSE wallet END,
               wallet_address = CASE WHEN wallet_address IS NULL AND $2 IS NOT NULL THEN $2 ELSE wallet_address END,
               country_code = COALESCE($3, country_code),
               last_seen_at = $4,
               session_count = session_count + 1,
               updated_at = $4
         WHERE id = $1
         RETURNING *`,
        [userId, wallet, countryCode ?? null, now.toISOString()],
      );
      user = mapUserRow(result.rows[0]);
    }

    const sessionId = randomUUID();
    await client.query(
      `INSERT INTO session_logs (id, user_id, country_code, created_at, last_activity_at)
       VALUES ($1, $2, $3, $4, $4)`,
      [sessionId, userId, user.countryCode ?? null, now.toISOString()],
    );

    return {
      user: {
        id: user.id,
        energy: user.energy,
        boost_level: user.boostLevel,
        boost_expires_at: user.boostExpiresAt ? user.boostExpiresAt.toISOString() : null,
        country_code: user.countryCode ?? null,
      },
    };
  });
}

export async function getUserBalance({
  userId,
}: {
  userId: string;
}) {
  const userResult = await query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0] ? mapUserRow(userResult.rows[0]) : null;
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
  return withTransaction(async (client) => {
    let user = await fetchUserById(client, userId, { forUpdate: true });
    ensureEntityExists(user, `User ${userId}`);

    const now = new Date();
    const today = todayKey(now);

    let dailyWatchCount = user.dailyWatchCount;
    let dailyWatchDate = user.dailyWatchDate;

    if (dailyWatchDate !== today) {
      dailyWatchCount = 0;
      dailyWatchDate = today;
    }

    if (dailyWatchCount >= DAILY_VIEW_LIMIT) {
      throw new Error('Daily ad limit reached');
    }

    const baseReward = getAdBaseReward(adId);
    const multiplier = boostMultiplier(user.boostLevel);
    const reward = Math.round(baseReward * multiplier * 100) / 100;

    const updatedResult = await client.query<UserRow>(
      `UPDATE users
         SET energy = $2,
             total_earned = $3,
             total_watches = $4,
             daily_watch_count = $5,
             daily_watch_date = $6,
             last_watch_at = $7,
             updated_at = $7
       WHERE id = $1
       RETURNING *`,
      [
        userId,
        user.energy + reward,
        user.totalEarned + reward,
        user.totalWatches + 1,
        dailyWatchCount + 1,
        dailyWatchDate,
        now.toISOString(),
      ],
    );

    user = mapUserRow(updatedResult.rows[0]);

    const watchLogId = randomUUID();
    await client.query(
      `INSERT INTO watch_logs (id, user_id, ad_id, reward, base_reward, multiplier, country_code, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [watchLogId, userId, adId, reward, baseReward, multiplier, user.countryCode ?? null, now.toISOString()],
    );

    await recordLedgerEntry(getExecutor(client), {
      userId,
      wallet: resolveUserWallet(user),
      amount: reward,
      type: 'credit',
      metadata: {
        adId,
        watchLogId,
      },
      idemKey: `ad:${watchLogId}`,
    });

    const dailyRemaining = Math.max(DAILY_VIEW_LIMIT - user.dailyWatchCount, 0);

    return {
      success: true,
      reward,
      new_balance: user.energy,
      multiplier,
      daily_watches_remaining: dailyRemaining,
    };
  });
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
  return withTransaction(async (client) => {
    const user = await fetchUserById(client, userId, { forUpdate: true });
    ensureEntityExists(user, `User ${userId}`);

    const boost = resolveBoost(boostLevel);
    const orderId = randomUUID();
    const payload = createPayload();

    const orderResult = await client.query<OrderRow>(
      `INSERT INTO orders (id, user_id, boost_level, ton_amount, status, payload, merchant_wallet)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6)
       RETURNING *`,
      [orderId, userId, boostLevel, boost.costTon, payload, DEFAULT_MERCHANT],
    );

    const order = orderResult.rows[0];

    return {
      order_id: order.id,
      address: order.merchant_wallet,
      amount: order.ton_amount,
      payload: order.payload,
      boost_name: boost.name,
      duration_days: boost.durationDays ?? 0,
    };
  });
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
  return withTransaction(async (client) => {
    const order = await fetchOrderById(client, orderId, { forUpdate: true });
    ensureEntityExists(order, `Order ${orderId}`);

    if (order.user_id !== userId) {
      throw new Error('Order does not belong to user');
    }

    let user = await fetchUserById(client, userId, { forUpdate: true });
    ensureEntityExists(user, `User ${userId}`);

    const boost = resolveBoost(order.boost_level);

    const now = new Date();
    const updatedOrderResult = await client.query<OrderRow>(
      `UPDATE orders
         SET status = 'paid',
             tx_hash = COALESCE($2, tx_hash),
             paid_at = $3,
             last_payment_check = $3
       WHERE id = $1
       RETURNING *`,
      [orderId, txHash ?? null, now.toISOString()],
    );

    const maxBoost = Math.max(user.boostLevel, order.boost_level);
    let boostExpires: Date | null = user.boostExpiresAt;
    if (boost.durationDays && boost.durationDays > 0) {
      const expires = new Date();
      expires.setUTCDate(expires.getUTCDate() + boost.durationDays);
      boostExpires = expires;
    }

    const updatedUserResult = await client.query<UserRow>(
      `UPDATE users
         SET boost_level = $2,
             boost_expires_at = $3,
             updated_at = $4
       WHERE id = $1
       RETURNING *`,
      [userId, maxBoost, boostExpires ? boostExpires.toISOString() : null, now.toISOString()],
    );

    user = mapUserRow(updatedUserResult.rows[0]);

    await recordLedgerEntry(getExecutor(client), {
      userId,
      wallet: resolveUserWallet(user),
      amount: order.ton_amount,
      type: 'debit',
      metadata: {
        orderId: order.id,
        txHash: txHash ?? order.tx_hash ?? null,
        boostLevel: order.boost_level,
      },
      idemKey: `order:confirm:${order.id}`,
    });

    return {
      success: true,
      boost_level: user.boostLevel,
      boost_expires_at: user.boostExpiresAt ? user.boostExpiresAt.toISOString() : null,
      multiplier: boostMultiplier(user.boostLevel),
    };
  });
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
  return withTransaction(async (client) => {
    const order = await fetchOrderById(client, orderId, { forUpdate: true });
    ensureEntityExists(order, `Order ${orderId}`);

    const verificationAttempts = order.verification_attempts + 1;
    const now = new Date();
    const updatedOrderResult = await client.query<OrderRow>(
      `UPDATE orders
         SET status = $2,
             last_payment_check = $3,
             verification_attempts = $4,
             verification_error = NULL,
             last_event = $5::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        orderId,
        status ?? 'pending_verification',
        now.toISOString(),
        verificationAttempts,
        JSON.stringify({
          id: Date.now(),
          status: 'submitted',
          receivedAt: now.toISOString(),
          wallet,
          amount,
        }),
      ],
    );

    const updatedOrder = updatedOrderResult.rows[0];

    const user = await fetchUserById(client, order.user_id);

    await recordLedgerEntry(getExecutor(client), {
      userId: order.user_id,
      wallet: resolveUserWallet(user, wallet),
      amount,
      type: 'debit',
      metadata: {
        orderId: order.id,
        boc,
        status: updatedOrder.status,
      },
      idemKey: `order:payment:${order.id}:${verificationAttempts}`,
    });

    return {
      success: true,
      order_id: order.id,
      status: updatedOrder.status,
    };
  });
}

export async function retryPayment({
  userId,
  orderId,
}: {
  userId: string;
  orderId: string;
}) {
  return withTransaction(async (client) => {
    const order = await fetchOrderById(client, orderId, { forUpdate: true });
    ensureEntityExists(order, `Order ${orderId}`);

    if (order.user_id !== userId) {
      throw new Error('Order does not belong to user');
    }

    const now = new Date();
    const updatedOrderResult = await client.query<OrderRow>(
      `UPDATE orders
         SET verification_attempts = verification_attempts + 1,
             last_payment_check = $2
       WHERE id = $1
       RETURNING *`,
      [orderId, now.toISOString()],
    );

    const updatedOrder = updatedOrderResult.rows[0];

    return {
      success: true,
      status: updatedOrder.status,
      verification_attempts: updatedOrder.verification_attempts,
      last_payment_check: updatedOrder.last_payment_check ? new Date(updatedOrder.last_payment_check).toISOString() : null,
    };
  });
}

export async function getPaymentStatus({
  userId,
  orderId,
}: {
  userId: string;
  orderId: string;
}) {
  const orderResult = await query<OrderRow>('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = orderResult.rows[0];
  ensureEntityExists(order, `Order ${orderId}`);

  if (order.user_id !== userId) {
    throw new Error('Order does not belong to user');
  }

  const lastEvent = order.last_event as PaymentEvent | null;

  return {
    order_id: order.id,
    status: order.status,
    paid_at: order.paid_at ? new Date(order.paid_at).toISOString() : null,
    tx_hash: order.tx_hash ?? null,
    tx_lt: order.tx_lt ?? null,
    verification_attempts: order.verification_attempts,
    verification_error: order.verification_error ?? null,
    last_payment_check: order.last_payment_check ? new Date(order.last_payment_check).toISOString() : null,
    last_event: lastEvent
      ? {
          id: lastEvent.id,
          status: lastEvent.status,
          received_at: new Date(lastEvent.receivedAt).toISOString(),
          wallet: lastEvent.wallet,
          amount: lastEvent.amount,
        }
      : undefined,
  };
}

export async function getUserStats({
  userId,
}: {
  userId: string;
}) {
  const userResult = await query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  const userRow = userResult.rows[0];
  const user = userRow ? mapUserRow(userRow) : null;
  ensureEntityExists(user, `User ${userId}`);

  const todayStart = new Date(todayKey());

  const [watchHistoryResult, todayCountResult, sessionsResult, totalEarnedResult] = await Promise.all([
    query<WatchLogRow>(
      `SELECT * FROM watch_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25`,
      [userId],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM watch_logs WHERE user_id = $1 AND created_at >= $2`,
      [userId, todayStart.toISOString()],
    ),
    query<SessionLogRow>(
      `SELECT * FROM session_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [userId],
    ),
    query<{ total: number | null }>(`SELECT COALESCE(SUM(reward), 0) AS total FROM watch_logs WHERE user_id = $1`, [userId]),
  ]);

  const totalEarnedValue = Number(totalEarnedResult.rows[0]?.total ?? 0);
  const todayCount = Number(todayCountResult.rows[0]?.count ?? '0');

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
    watch_history: watchHistoryResult.rows.map((item) => ({
      id: item.id,
      user_id: userId,
      ad_id: item.ad_id,
      reward: item.reward,
      base_reward: item.base_reward,
      multiplier: item.multiplier,
      created_at: new Date(item.created_at).toISOString(),
      country_code: item.country_code ?? null,
    })),
    session_history: sessionsResult.rows.map((session) => ({
      id: session.id,
      user_id: userId,
      country_code: session.country_code ?? null,
      created_at: new Date(session.created_at).toISOString(),
      last_activity_at: new Date(session.last_activity_at).toISOString(),
    })),
  };
}

export async function getRewardStatus({
  userId,
}: {
  userId: string;
}) {
  const userResult = await query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0] ? mapUserRow(userResult.rows[0]) : null;
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

  return withTransaction(async (client) => {
    let user = await fetchUserById(client, userId, { forUpdate: true });
    ensureEntityExists(user, `User ${userId}`);

    if (user.claimedPartners.includes(partnerId)) {
      throw new Error('Reward already claimed');
    }

    const now = new Date();
    const updatedResult = await client.query<UserRow>(
      `UPDATE users
         SET claimed_partners = $2,
             energy = $3,
             total_earned = $4,
             updated_at = $5
       WHERE id = $1
       RETURNING *`,
      [
        userId,
        [...user.claimedPartners, partnerId],
        user.energy + partner.reward,
        user.totalEarned + partner.reward,
        now.toISOString(),
      ],
    );

    user = mapUserRow(updatedResult.rows[0]);

    const rewardClaimId = randomUUID();
    await client.query(
      `INSERT INTO reward_claims (id, user_id, partner_id, reward, partner_name, claimed_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [rewardClaimId, userId, partnerId, partner.reward, partner.name, now.toISOString()],
    );

    await recordLedgerEntry(getExecutor(client), {
      userId,
      wallet: resolveUserWallet(user),
      amount: partner.reward,
      type: 'credit',
      metadata: {
        partnerId,
        partnerName: partner.name,
        rewardClaimId,
      },
      idemKey: `reward:${rewardClaimId}`,
    });

    return {
      success: true,
      reward: partner.reward,
      new_balance: user.energy,
      partner_name: partner.name,
    };
  });
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
  const userResult = await query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0] ? mapUserRow(userResult.rows[0]) : null;
  ensureEntityExists(user, `User ${userId}`);

  const requestedPage = Number(page);
  const requestedLimit = Number(limit);
  const normalizedPage = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const normalizedLimit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 20;
  const offset = (normalizedPage - 1) * normalizedLimit;

  const [entriesResult, countResult] = await Promise.all([
    query<LedgerRow>(
      `SELECT * FROM ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, normalizedLimit, offset],
    ),
    query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM ledger WHERE user_id = $1`, [userId]),
  ]);

  const total = Number(countResult.rows[0]?.total ?? '0');
  const entries = entriesResult.rows;

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      user_id: entry.user_id,
      wallet: entry.wallet,
      amount: entry.amount,
      currency: entry.currency,
      type: entry.type,
      metadata: entry.metadata ?? null,
      created_at: new Date(entry.created_at).toISOString(),
    })),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      has_next: offset + entries.length < total,
    },
  };
}
