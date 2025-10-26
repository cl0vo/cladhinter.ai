import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

import { connectToDatabase } from './mongo';
import {
  addUser,
  claimReward,
  completeAdWatch,
  createOrder,
  getPaymentStatus,
  getRewardStatus,
  getUserBalance,
  getUserStats,
  initUser,
  listUsers,
  registerTonPayment,
  retryPayment,
  confirmOrder,
} from './services/userService';
import {
  finishWalletProofSession,
  startWalletProofSession,
  type WalletProofFinishInput,
} from './services/walletProofService';

async function readJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  const payload = Buffer.concat(chunks).toString('utf8');

  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    throw new Error('Invalid JSON payload');
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(body);
}

function isApiRequest(url?: string | null): boolean {
  return Boolean(url && url.startsWith('/api'));
}

type NextFunction = () => void;
type Middleware = (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void | Promise<void>;

export function createApiMiddleware(): Middleware {
  return async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
    if (!isApiRequest(req.url)) {
      next();
      return;
    }

    try {
      await connectToDatabase();
    } catch (error) {
      sendJson(res, 500, { error: (error as Error).message });
      return;
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname } = url;

    try {
      if (req.method === 'GET' && pathname === '/api/users') {
        const users = await listUsers();
        sendJson(res, 200, { users });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/users') {
        const body = await readJsonBody<{ userId: string; walletAddress?: string | null; countryCode?: string | null }>(req);
        if (!body?.userId) {
          sendJson(res, 400, { error: 'userId is required' });
          return;
        }

        const user = await addUser(body.userId, body.walletAddress, body.countryCode);
        sendJson(res, 201, {
          id: user._id,
          energy: user.energy,
          boost_level: user.boostLevel,
          boost_expires_at: user.boostExpiresAt ? user.boostExpiresAt.toISOString() : null,
          country_code: user.countryCode ?? null,
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/users/init') {
        const body = await readJsonBody(req);
        const result = await initUser(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/wallet/proof/start') {
        const body = await readJsonBody<{ userId?: string | null; wallet?: string | null }>(req);
        const result = await startWalletProofSession({
          userId: body?.userId ?? null,
          wallet: body?.wallet ?? null,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/wallet/proof/finish') {
        const body = await readJsonBody<WalletProofFinishInput>(req);

        if (!body?.address || !body?.chain || !body?.publicKey || !body?.nonce) {
          sendJson(res, 400, { error: 'Invalid wallet proof request' });
          return;
        }

        if (!body.proof?.payload || !body.proof?.signature || !body.proof?.domain) {
          sendJson(res, 400, { error: 'Invalid wallet proof payload' });
          return;
        }

        const result = await finishWalletProofSession(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/users/balance') {
        const body = await readJsonBody(req);
        const result = await getUserBalance(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/users/stats') {
        const body = await readJsonBody(req);
        const result = await getUserStats(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/ads/complete') {
        const body = await readJsonBody(req);
        const result = await completeAdWatch(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders') {
        const body = await readJsonBody(req);
        const result = await createOrder(body);
        sendJson(res, 201, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders/confirm') {
        const body = await readJsonBody(req);
        const result = await confirmOrder(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders/register-payment') {
        const body = await readJsonBody(req);
        const result = await registerTonPayment(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders/retry-payment') {
        const body = await readJsonBody(req);
        const result = await retryPayment(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders/status') {
        const body = await readJsonBody(req);
        const result = await getPaymentStatus(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/rewards/status') {
        const body = await readJsonBody(req);
        const result = await getRewardStatus(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/rewards/claim') {
        const body = await readJsonBody(req);
        const result = await claimReward(body);
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error';
      sendJson(res, 400, { error: message });
    }
  };
}

