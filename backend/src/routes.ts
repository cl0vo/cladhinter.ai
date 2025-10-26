import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

import { ensureDatabase } from './postgres';
import {
  claimReward,
  completeAdWatch,
  createOrder,
  getPaymentStatus,
  getRewardStatus,
  getUserBalance,
  getUserStats,
  initUser,
  registerTonPayment,
  retryPayment,
  confirmOrder,
  getLedgerHistory,
} from './services/userService';
import {
  finishWalletProofSession,
  startWalletProofSession,
  type WalletProofFinishInput,
} from './services/walletProofService';
import { HttpError } from './errors';

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

function getCorsAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw) {
    return ['*'];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  for (const allowed of allowedOrigins) {
    if (allowed === '*') {
      return true;
    }

    if (allowed === origin) {
      return true;
    }

    try {
      const parsed = new URL(origin);
      if (allowed === parsed.origin || allowed === parsed.host) {
        return true;
      }
    } catch (error) {
      if (allowed === origin) {
        return true;
      }
    }
  }

  return false;
}

function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: string[],
): boolean {
  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

  if (origin) {
    const trimmedOrigin = origin.trim();
    if (!isOriginAllowed(trimmedOrigin, allowedOrigins)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Origin not allowed' }));
      return true;
    }

    res.setHeader('Access-Control-Allow-Origin', trimmedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    const requestedHeaders = req.headers['access-control-request-headers'];
    if (requestedHeaders) {
      res.setHeader(
        'Access-Control-Allow-Headers',
        Array.isArray(requestedHeaders)
          ? requestedHeaders.join(', ')
          : requestedHeaders,
      );
    } else {
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return true;
    }
  } else if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return true;
  }

  return false;
}

type NextFunction = () => void;
type Middleware = (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void | Promise<void>;

export function createApiMiddleware(): Middleware {
  const corsAllowedOrigins = getCorsAllowedOrigins();

  return async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
    if (!isApiRequest(req.url)) {
      next();
      return;
    }

    if (applyCors(req, res, corsAllowedOrigins)) {
      return;
    }

    try {
      await ensureDatabase();
    } catch (error) {
      sendJson(res, 500, { error: (error as Error).message });
      return;
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname } = url;

    try {
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

      if (req.method === 'POST' && pathname === '/api/ledger/history') {
        const body = await readJsonBody(req);
        const result = await getLedgerHistory(body);
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 400;
      const message = error instanceof Error ? error.message : 'Unexpected server error';
      sendJson(res, status, { error: message });
    }
  };
}

