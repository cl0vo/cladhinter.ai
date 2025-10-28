const DEFAULT_PORT = 4000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_CORS_ORIGINS = ['*'];
const DEFAULT_WALLET_PROOF_TTL_SECONDS = 60 * 15; // 15 minutes
const DEFAULT_TON_MAINNET_RPC = 'https://mainnet-v4.tonhubapi.com';
const DEFAULT_RATE_LIMIT_MAX = 120;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

function parseIntegerEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveIntegerEnv(value: string | undefined, fallback: number): number {
  const parsed = parseIntegerEnv(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function parseCorsList(raw: string | undefined): string[] {
  if (!raw) {
    return DEFAULT_CORS_ORIGINS;
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getNodeEnv(): string {
  return process.env.NODE_ENV?.trim() || 'development';
}

export function getHttpConfig(): { host: string; port: number } {
  const host = process.env.HOST?.trim() || DEFAULT_HOST;
  const port = parseIntegerEnv(process.env.PORT, DEFAULT_PORT);
  return { host, port };
}

export function getCorsAllowedOrigins(): string[] {
  return parseCorsList(process.env.CORS_ALLOWED_ORIGINS);
}

export function getWalletProofTtlSeconds(): number {
  return parseIntegerEnv(process.env.WALLET_PROOF_TTL_SECONDS, DEFAULT_WALLET_PROOF_TTL_SECONDS);
}

export function getTonMainnetRpc(): string {
  return process.env.TON_MAINNET_RPC?.trim() || DEFAULT_TON_MAINNET_RPC;
}

export function getRateLimitConfig(): { windowMs: number; max: number } {
  const max = parsePositiveIntegerEnv(process.env.API_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX);
  const windowMs = parsePositiveIntegerEnv(
    process.env.API_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
  );
  return { max, windowMs };
}

export function getServerHmacSecret(): string {
  const secret = process.env.SERVER_HMAC_SECRET?.trim();
  if (secret && secret.length >= 16) {
    return secret;
  }
  return process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error('SERVER_HMAC_SECRET must be provided in production');
      })()
    : 'insecure-dev-wallet-proof-secret';
}

export function getDatabaseUrl(): string {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL_NO_SSL,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  throw new Error('Missing DATABASE_URL environment variable');
}
