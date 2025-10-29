import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import {
  claimReward,
  completeAdWatch,
  confirmOrder,
  createOrder,
  getRewardStatus,
  getUserBalance,
  getUserStats,
  initUser,
} from './services/userService';

type AuthenticatedRequest = Request & { userId: string };

const router = Router();

function asyncHandler<T extends AuthenticatedRequest>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use((req: AuthenticatedRequest, res, next) => {
  const headerId = req.header('x-user-id')?.trim();
  const bodyId =
    typeof req.body === 'object' && req.body && 'userId' in req.body
      ? String((req.body as Record<string, unknown>).userId)
      : undefined;
  const queryId = typeof req.query?.userId === 'string' ? req.query.userId : undefined;

  const userId = headerId || bodyId || queryId;

  if (!userId) {
    res.status(401).json({ error: 'Missing user identifier. Provide X-User-ID header.' });
    return;
  }

  req.userId = userId;
  next();
});

router.post(
  '/user/init',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload = await initUser(req.userId);
    res.json(payload);
  }),
);

router.get(
  '/user/balance',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const balance = await getUserBalance(req.userId);
    res.json(balance);
  }),
);

router.post(
  '/ads/complete',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      ad_id: z.string().min(1),
      ad_type: z.string().optional(),
    });
    const { ad_id, ad_type } = schema.parse(req.body ?? {});
    const result = await completeAdWatch({
      userId: req.userId,
      adId: ad_id,
      adType: ad_type,
    });
    res.json(result);
  }),
);

router.get(
  '/stats',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stats = await getUserStats(req.userId);
    res.json(stats);
  }),
);

router.get(
  '/rewards/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const status = await getRewardStatus(req.userId);
    res.json(status);
  }),
);

router.post(
  '/rewards/claim',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      partner_id: z.string().min(1),
    });
    const { partner_id } = schema.parse(req.body ?? {});
    const result = await claimReward({
      userId: req.userId,
      partnerId: partner_id,
    });
    res.json(result);
  }),
);

router.post(
  '/orders/create',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      boost_level: z.coerce.number().int().min(0),
    });
    const { boost_level } = schema.parse(req.body ?? {});
    const order = await createOrder({
      userId: req.userId,
      boostLevel: boost_level,
    });
    res.json(order);
  }),
);

router.post(
  '/orders/:orderId/confirm',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      tx_hash: z.string().optional(),
    });
    const { tx_hash } = schema.parse(req.body ?? {});
    const result = await confirmOrder({
      userId: req.userId,
      orderId: req.params.orderId,
      txHash: tx_hash,
    });
    res.json(result);
  }),
);

export default router;
