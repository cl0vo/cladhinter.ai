import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

import { getCorsAllowedOrigins, getRateLimitConfig } from './config';
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
  type OrderStatus,
} from './services/userService';
import {
  finishWalletProofSession,
  startWalletProofSession,
  verifyAccessToken,
  type WalletProofFinishInput,
} from './services/walletProofService';
import { HttpError, UnauthorizedError } from './errors';

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

interface RequestContext {
  userId: string;
  wallet: string;
  accessToken: string;
}

const requestContexts = new WeakMap<IncomingMessage, RequestContext>();

function getRequestContext(req: IncomingMessage): RequestContext | null {
  return requestContexts.get(req) ?? null;
}

function sanitizeAuthFields(body: Record<string, unknown> | null | undefined): void {
  if (!body) {
    return;
  }
  if ('userId' in body) {
    delete body.userId;
  }
  if ('accessToken' in body) {
    delete body.accessToken;
  }
}

function toSingleHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    const [first] = value;
    return typeof first === 'string' ? first : null;
  }
  return null;
}

function extractDomainCandidate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const tryParse = (input: string): string | null => {
    try {
      const url = new URL(input);
      if (url.host) {
        return url.host;
      }
    } catch {
      // ignore parsing failures
    }
    return null;
  };

  const parsedDirect = tryParse(trimmed);
  if (parsedDirect) {
    return parsedDirect;
  }

  if (!trimmed.includes('://')) {
    const parsedWithScheme = tryParse(`https://${trimmed}`);
    if (parsedWithScheme) {
      return parsedWithScheme;
    }
  }

  const [hostPart] = trimmed.split('/');
  return hostPart && hostPart.trim() ? hostPart.trim() : null;
}

function extractAccessToken(
  req: IncomingMessage,
  body: Record<string, unknown> | null | undefined,
): string | null {
  const authHeader = req.headers['authorization'] as string | string[] | undefined;
  if (typeof authHeader === 'string') {
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return token.trim();
    }
  } else if (Array.isArray(authHeader) && authHeader.length > 0) {
    const [scheme, token] = authHeader[0]?.split(' ') ?? [];
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return token.trim();
    }
  }

  if (body && typeof body.accessToken === 'string') {
    return body.accessToken;
  }

  return null;
}

async function authenticateRequest(
  req: IncomingMessage,
  body: Record<string, unknown> | null | undefined,
): Promise<RequestContext> {
  const existing = getRequestContext(req);
  if (existing) {
    return existing;
  }

  const token = extractAccessToken(req, body);
  if (!token) {
    throw new UnauthorizedError('Missing access token');
  }

  const expectedUser =
    body && typeof body.userId === 'string' ? (body.userId as string) : undefined;

  let payload;
  try {
    payload = await verifyAccessToken(token, { userId: expectedUser });
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, error instanceof Error ? error.message : 'Invalid access token');
  }

  sanitizeAuthFields(body);

  const context: RequestContext = {
    userId: payload.userId,
    wallet: payload.wallet,
    accessToken: token,
  };
  requestContexts.set(req, context);
  return context;
}

type RateLimitBucket = { count: number; resetAt: number };
const rateLimitBuckets = new Map<string, RateLimitBucket>();
const ALLOWED_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'pending_verification',
  'awaiting_webhook',
  'paid',
  'failed',
];

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const first = forwarded.split(',')[0];
    if (first) {
      return first.trim();
    }
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(',')[0];
    if (first) {
      return first.trim();
    }
  }

  return req.socket?.remoteAddress ?? 'unknown';
}

function enforceRateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  config: { windowMs: number; max: number },
): boolean {
  if (req.method === 'OPTIONS') {
    return false;
  }

  const ip = getClientIp(req);
  if (!ip) {
    return false;
  }

  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + config.windowMs });
    return false;
  }

  if (bucket.count >= config.max) {
    const retryAfter = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Retry-After', retryAfter.toString());
    res.end(JSON.stringify({ error: 'Too many requests' }));
    return true;
  }

  bucket.count += 1;
  return false;
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
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
  const rateLimitConfig = getRateLimitConfig();

  return async (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
    if (!isApiRequest(req.url)) {
      next();
      return;
    }

    if (applyCors(req, res, corsAllowedOrigins)) {
      return;
    }

    if (enforceRateLimit(req, res, rateLimitConfig)) {
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
      if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/users/init') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const body = rawBody as { walletAddress?: string | null; countryCode?: string | null };
        const result = await initUser({
          userId: ctx.userId,
          walletAddress: body.walletAddress ?? null,
          countryCode: body.countryCode ?? null,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/wallet/proof/start') {
        const body = await readJsonBody<{
          userId?: string | null;
          wallet?: string | null;
          domain?: string | null;
        }>(req);
        const bodyDomain = extractDomainCandidate(body?.domain ?? null);
        const originDomain = extractDomainCandidate(toSingleHeaderValue(req.headers.origin));
        const forwardedDomain = extractDomainCandidate(
          toSingleHeaderValue(req.headers['x-forwarded-host'] as string | string[] | undefined),
        );
        const hostDomain = extractDomainCandidate(toSingleHeaderValue(req.headers.host));
        const resolvedDomain = originDomain ?? forwardedDomain ?? bodyDomain ?? hostDomain ?? null;

        console.log('[wallet-proof] start', {
          userId: body?.userId ?? null,
          wallet: body?.wallet ?? null,
          domain: resolvedDomain,
        });
        const result = await startWalletProofSession({
          userId: body?.userId ?? null,
          wallet: body?.wallet ?? null,
          domain: resolvedDomain,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/wallet/proof/finish') {
        const body = await readJsonBody<WalletProofFinishInput>(req);

        if (!body?.address || !body?.chain || !body?.nonce) {
          sendJson(res, 400, { error: 'Invalid wallet proof request' });
          return;
        }

        if (!body.proof?.payload || !body.proof?.signature || !body.proof?.domain) {
          sendJson(res, 400, { error: 'Invalid wallet proof payload' });
          return;
        }

        const normalizedBody: WalletProofFinishInput = {
          ...body,
          publicKey: typeof body.publicKey === 'string' ? body.publicKey : '',
        };

        console.log('[wallet-proof] finish request', {
          address: body.address.slice(0, 10),
          chain: normalizedBody.chain,
          domain: normalizedBody.proof.domain?.value,
          hasStateInit: Boolean(normalizedBody.proof.state_init),
          payloadLength: normalizedBody.proof.payload?.length ?? 0,
          providedPublicKey: normalizedBody.publicKey ? 'present' : 'missing',
        });

        try {
          const result = await finishWalletProofSession(normalizedBody);
          sendJson(res, 200, result);
        } catch (error) {
          console.error(
            '[wallet-proof] finish failed',
            error instanceof Error ? error.message : error,
          );
          throw error;
        }
        return;
      }

      if (req.method === 'POST' && pathname === '/api/users/balance') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const result = await getUserBalance({ userId: ctx.userId });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/users/stats') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const result = await getUserStats({ userId: ctx.userId });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/ads/complete') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const body = rawBody as { adId?: string; ad_id?: string };
        const adIdCandidate =
          typeof body.adId === 'string' && body.adId.trim()
            ? body.adId.trim()
            : typeof body.ad_id === 'string' && body.ad_id.trim()
              ? body.ad_id.trim()
              : '';
        if (!adIdCandidate) {
          sendJson(res, 400, { error: 'Missing adId' });
          return;
        }
        const result = await completeAdWatch({
          userId: ctx.userId,
          adId: adIdCandidate,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const body = rawBody as { boostLevel?: number; boost_level?: number };
        const boostLevelValue = Number(
          body.boostLevel ?? body.boost_level ?? Number.NaN,
        );
        if (!Number.isFinite(boostLevelValue)) {
          sendJson(res, 400, { error: 'Invalid boost level' });
          return;
        }
        const result = await createOrder({
          userId: ctx.userId,
          boostLevel: Math.trunc(boostLevelValue),
        });
        sendJson(res, 201, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders/confirm') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const body = rawBody as { orderId?: string; order_id?: string; txHash?: string | null; tx_hash?: string | null };
        const orderId =
          typeof body.orderId === 'string' && body.orderId.trim()
            ? body.orderId.trim()
            : typeof body.order_id === 'string' && body.order_id.trim()
              ? body.order_id.trim()
              : '';
        if (!orderId) {
          sendJson(res, 400, { error: 'Missing orderId' });
          return;
        }
        const txHash =
          typeof body.txHash === 'string' && body.txHash.trim()
            ? body.txHash.trim()
            : typeof body.tx_hash === 'string' && body.tx_hash.trim()
              ? body.tx_hash.trim()
              : null;
        const result = await confirmOrder({
          userId: ctx.userId,
          orderId,
          txHash,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders/register-payment') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const body = rawBody as {
          orderId?: string;
          order_id?: string;
          wallet?: string;
          amount?: number | string;
          tonAmount?: number | string;
          ton_amount?: number | string;
          boc?: string;
          status?: string;
        };
        const orderId =
          typeof body.orderId === 'string' && body.orderId.trim()
            ? body.orderId.trim()
            : typeof body.order_id === 'string' && body.order_id.trim()
              ? body.order_id.trim()
              : '';
        const wallet =
          typeof body.wallet === 'string' && body.wallet.trim() ? body.wallet.trim() : '';
        const amountCandidate =
          body.amount ?? body.tonAmount ?? body.ton_amount ?? Number.NaN;
        const amount = Number(amountCandidate);
        const boc =
          typeof body.boc === 'string' && body.boc.trim() ? body.boc.trim() : '';
        const statusValue =
          typeof body.status === 'string' && body.status.trim()
            ? body.status.trim()
            : undefined;
        const status =
          statusValue && (ALLOWED_ORDER_STATUSES as readonly OrderStatus[]).includes(statusValue as OrderStatus)
            ? (statusValue as OrderStatus)
            : undefined;

        if (!orderId || !wallet || !boc || !Number.isFinite(amount)) {
          sendJson(res, 400, { error: 'Invalid payment payload' });
          return;
        }

        if (statusValue && !status) {
          sendJson(res, 400, { error: 'Invalid status value' });
          return;
        }

        const result = await registerTonPayment({
          userId: ctx.userId,
          orderId,
          wallet,
          amount,
          boc,
          status,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders/retry-payment') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const body = rawBody as { orderId?: string; order_id?: string };
        const orderId =
          typeof body.orderId === 'string' && body.orderId.trim()
            ? body.orderId.trim()
            : typeof body.order_id === 'string' && body.order_id.trim()
              ? body.order_id.trim()
              : '';
        if (!orderId) {
          sendJson(res, 400, { error: 'Missing orderId' });
          return;
        }
        const result = await retryPayment({
          userId: ctx.userId,
          orderId,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders/status') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const body = rawBody as { orderId?: string; order_id?: string };
        const orderId =
          typeof body.orderId === 'string' && body.orderId.trim()
            ? body.orderId.trim()
            : typeof body.order_id === 'string' && body.order_id.trim()
              ? body.order_id.trim()
              : '';
        if (!orderId) {
          sendJson(res, 400, { error: 'Missing orderId' });
          return;
        }
        const result = await getPaymentStatus({
          userId: ctx.userId,
          orderId,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/rewards/status') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const result = await getRewardStatus({ userId: ctx.userId });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/rewards/claim') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const body = rawBody as { partnerId?: string; partner_id?: string };
        const partnerId =
          typeof body.partnerId === 'string' && body.partnerId.trim()
            ? body.partnerId.trim()
            : typeof body.partner_id === 'string' && body.partner_id.trim()
              ? body.partner_id.trim()
              : '';
        if (!partnerId) {
          sendJson(res, 400, { error: 'Missing partnerId' });
          return;
        }
        const result = await claimReward({
          userId: ctx.userId,
          partnerId,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/ledger/history') {
        const rawBody = await readJsonBody<Record<string, unknown>>(req);
        const ctx = await authenticateRequest(req, rawBody);
        const body = rawBody as { page?: number | string; limit?: number | string };
        const parsedPage = Number(body.page);
        const parsedLimit = Number(body.limit);
        const result = await getLedgerHistory({
          userId: ctx.userId,
          page: Number.isFinite(parsedPage) ? parsedPage : undefined,
          limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        });
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

