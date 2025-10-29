import 'dotenv/config';

const DEFAULT_PORT = 4000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_MERCHANT_WALLET =
  'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 120;

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCorsList(raw: string | undefined): string[] {
  if (!raw) {
    return ['*'];
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getHttpConfig(): { host: string; port: number } {
  const port = parseInteger(process.env.PORT, DEFAULT_PORT);
  const host = process.env.HOST?.trim() || DEFAULT_HOST;
  return { host, port };
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL must be provided for the backend API');
  }
  return url;
}

export function getCorsAllowedOrigins(): string[] {
  return parseCorsList(process.env.CORS_ALLOWED_ORIGINS);
}

export function getMerchantWalletAddress(): string {
  return process.env.MERCHANT_WALLET?.trim() || DEFAULT_MERCHANT_WALLET;
}

export function getNodeEnv(): string {
  return process.env.NODE_ENV?.trim() || 'development';
}

export function getRateLimitConfig(): { windowMs: number; max: number } {
  return {
    windowMs: parsePositiveInteger(
      process.env.API_RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
    ),
    max: parsePositiveInteger(process.env.API_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
  };
}
function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = parseInteger(value, fallback);
  return parsed > 0 ? parsed : fallback;
}
