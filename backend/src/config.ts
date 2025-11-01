import 'dotenv/config';

const DEFAULT_PORT = 4000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_MERCHANT_WALLET =
  'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 120;
const DEFAULT_TON_API_BASE_URL = 'https://tonapi.io';
const DEFAULT_TON_PROOF_TTL_SECONDS = 15 * 60;
const DEFAULT_SENTRY_TRACES_SAMPLE_RATE = 0;
const DEFAULT_SENTRY_PROFILES_SAMPLE_RATE = 0;
const DEFAULT_TON_PROOF_ALLOWED_DOMAINS = [
  'localhost:5173',
  '127.0.0.1:5173',
  'cladhunter-ai-frontend.vercel.app',
  'cladhunter.app',
  'www.cladhunter.app',
];

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

export function getTonApiConfig(): { baseUrl: string; apiKey?: string } {
  const baseUrl = process.env.TON_API_BASE_URL?.trim() || DEFAULT_TON_API_BASE_URL;
  const apiKey = process.env.TON_API_KEY?.trim() || undefined;
  return { baseUrl, apiKey };
}

export function getTonWebhookSecret(): string | null {
  return process.env.TON_WEBHOOK_SECRET?.trim() || null;
}
function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = parseInteger(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function parseSampleRate(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function parseStringList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) {
    return fallback;
  }
  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

export function getTonProofConfig(): { allowedDomains: string[]; maxAgeSeconds: number } {
  const allowedDomains = parseStringList(
    process.env.TON_PROOF_ALLOWED_DOMAINS,
    DEFAULT_TON_PROOF_ALLOWED_DOMAINS,
  );
  const maxAgeSeconds = parsePositiveInteger(
    process.env.TON_PROOF_TTL_SECONDS,
    DEFAULT_TON_PROOF_TTL_SECONDS,
  );
  return { allowedDomains, maxAgeSeconds };
}

export function getSentryConfig(): {
  dsn: string | null;
  tracesSampleRate: number;
  profilesSampleRate: number;
} {
  const dsn = process.env.SENTRY_DSN?.trim() || null;
  const tracesSampleRate = parseSampleRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
    DEFAULT_SENTRY_TRACES_SAMPLE_RATE,
  );
  const profilesSampleRate = parseSampleRate(
    process.env.SENTRY_PROFILES_SAMPLE_RATE,
    DEFAULT_SENTRY_PROFILES_SAMPLE_RATE,
  );
  return { dsn, tracesSampleRate, profilesSampleRate };
}
