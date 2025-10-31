import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { getTonProofConfig, getTonWebhookSecret } from './config';
import { createWalletSession, verifyAccessToken, type WalletSession } from './services/authService';
import {
  claimReward,
  completeAdWatch,
  confirmOrder,
  createOrder,
  getRewardStatus,
  getUserBalance,
  getUserStats,
  initUser,
  registerTonWebhookPayment,
} from './services/userService';
import { generateTonProofPayload, verifyTonProof } from './services/tonProofService';

type AuthenticatedRequest = Request & { userId: string; accessToken: string };

const router = Router();

function asyncHandler(
  handler: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as AuthenticatedRequest, res, next).catch(next);
  };
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/auth/ton-connect', async (req, res, next) => {
  try {
    const proofSchema = z.object({
      timestamp: z.number().int(),
      domain: z.object({
        value: z.string().min(1),
        lengthBytes: z.number().int().nonnegative(),
      }),
      signature: z.string().min(1),
      payload: z.string().min(1),
      state_init: z.string().optional(),
    });

    const schema = z.object({
      address: z.string().min(1),
      network: z.union([z.string(), z.number()]),
      public_key: z.string().regex(/^[0-9a-fA-F]{64}$/),
      state_init: z.string().optional(),
      proof: proofSchema,
    });

    const parsed = schema.parse(req.body ?? {});
    const { allowedDomains, maxAgeSeconds } = getTonProofConfig();

    const verification = await verifyTonProof(
      {
        address: parsed.address,
        network: parsed.network,
        publicKey: parsed.public_key,
        stateInit: parsed.state_init,
        proof: parsed.proof,
      },
      {
        allowedDomains,
        maxAgeSeconds,
      },
    );

    if (!verification.ok || !verification.walletAddress) {
      res.status(401).json({ error: 'Invalid ton-proof payload' });
      return;
    }

    const session: WalletSession = await createWalletSession(verification.walletAddress);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

router.get('/auth/ton-connect/challenge', async (_req, res, next) => {
  try {
    const payload = await generateTonProofPayload();
    res.json({ payload });
  } catch (error) {
    next(error);
  }
});

router.post('/payments/ton/webhook', (req, res, next) => {
  (async () => {
    const secret = getTonWebhookSecret();
    if (secret) {
      const provided = req.header('x-webhook-secret')?.trim();
      if (provided !== secret) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    const schema = z.object({
      order_id: z.string().min(1).optional(),
      orderId: z.string().min(1).optional(),
      tx_hash: z.string().min(1).optional(),
      txHash: z.string().min(1).optional(),
      amount_ton: z.number().positive().optional(),
      amountTon: z.number().positive().optional(),
    });

    const parsed = schema.parse(req.body ?? {});
    const orderId = parsed.orderId ?? parsed.order_id;
    const txHash = parsed.txHash ?? parsed.tx_hash;
    const amountTon = parsed.amountTon ?? parsed.amount_ton;

    if (!orderId || !txHash) {
      res.status(400).json({ error: 'Missing orderId or txHash' });
      return;
    }

    const result = await registerTonWebhookPayment({
      orderId,
      txHash,
      amountTon,
    });

    res.json(result);
  })().catch(next);
});

router.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.header('x-user-id')?.trim() ?? '';
    const authHeader = req.header('authorization')?.trim() ?? '';

    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = bearerMatch?.[1]?.trim() ?? '';

    if (!userId || !token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const valid = await verifyAccessToken(userId, token);
    if (!valid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const authRequest = req as AuthenticatedRequest;
    authRequest.userId = userId;
    authRequest.accessToken = token;

    next();
  } catch (error) {
    next(error);
  }
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
      tx_hash: z
        .string()
        .trim()
        .min(1, 'tx_hash is required'),
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
