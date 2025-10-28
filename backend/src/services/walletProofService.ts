import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { getSecureRandomBytes, sha256 } from '@ton/crypto';
import {
  Address,
  Cell,
  loadStateInit,
  Slice,
  StateInit,
  TonClient4,
  type TonClient4Parameters,
  WalletContractV1R1,
  WalletContractV1R2,
  WalletContractV1R3,
  WalletContractV2R1,
  WalletContractV2R2,
  WalletContractV3R1,
  WalletContractV3R2,
  WalletContractV4,
  WalletContractV5Beta,
  WalletContractV5R1,
} from '@ton/ton';
import nacl from 'tweetnacl';

import { query } from '../postgres';
import { UnauthorizedError } from '../errors';
import type { QueryResultRow } from 'pg';

const TON_PROOF_PREFIX = 'ton-proof-item-v2/';
const TON_CONNECT_PREFIX = 'ton-connect';

const DEFAULT_ALLOWED_DOMAINS = [
  'localhost:5173',
  '127.0.0.1:5173',
  'localhost:4173',
  '127.0.0.1:4173',
  'ton-connect.github.io',
];
const DEFAULT_TON_ENDPOINT = 'https://mainnet-v4.tonhubapi.com';
const DEV_FALLBACK_HMAC_SECRET = 'insecure-dev-wallet-proof-secret';
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24 hours

interface TonProofDomain {
  lengthBytes: number;
  value: string;
}

interface TonProofPayload {
  address: string;
  network: string;
  public_key: string;
  proof: {
    timestamp: number;
    domain: TonProofDomain;
    payload: string;
    signature: string;
    state_init?: string;
  };
}

interface WalletSessionRow extends QueryResultRow {
  nonce_hash: string;
  user_id: string | null;
  wallet: string | null;
  ttl: Date | string;
}

interface WalletTokenRow extends QueryResultRow {
  token_hash: string;
  user_id: string;
  wallet: string;
  expires_at: Date | string;
  last_used_at: Date | string | null;
}

interface UserRow extends QueryResultRow {
  id: string;
  wallet: string | null;
  wallet_address: string | null;
  wallet_verified: boolean;
  last_seen_at: Date | string;
}

export interface WalletProofStartResult {
  nonce: string;
  expiresAt: string;
}

export interface WalletProofSessionOptions {
  userId?: string | null;
  wallet?: string | null;
}

export interface WalletProofFinishInput {
  address: string;
  rawAddress?: string;
  chain: string;
  publicKey: string;
  nonce: string;
  userId?: string | null;
  proof: {
    timestamp: number;
    domain: TonProofDomain;
    payload: string;
    signature: string;
    state_init?: string;
  };
}

export interface WalletProofFinishResult {
  success: true;
  userId: string;
  wallet: string;
  accessToken: string;
}

export interface AccessTokenPayload {
  userId: string;
  wallet: string;
  exp: number;
}

let tonClient: TonClient4 | null = null;

function getTonClient(): TonClient4 {
  if (tonClient) {
    return tonClient;
  }

  const endpoint = process.env.TON_MAINNET_RPC ?? DEFAULT_TON_ENDPOINT;
  const params: TonClient4Parameters = { endpoint };
  tonClient = new TonClient4(params);
  return tonClient;
}

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

function getHmacSecret(): string {
  const secret = process.env.SERVER_HMAC_SECRET;
  if (secret) {
    return secret;
  }

  if (!isProduction()) {
    console.warn('[wallet-proof] Falling back to insecure dev HMAC secret. Configure SERVER_HMAC_SECRET for production.');
    return DEV_FALLBACK_HMAC_SECRET;
  }

  throw new Error('SERVER_HMAC_SECRET is not configured');
}

function getTtlSeconds(): number {
  const raw = process.env.WALLET_PROOF_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : 15 * 60;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60;
}

function getAccessTokenTtlSeconds(): number {
  const raw = process.env.ACCESS_TOKEN_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
}

function parseDomainCandidate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidates = [trimmed];

  if (!/^\w+:\/\//.test(trimmed)) {
    candidates.push(`https://${trimmed}`);
  }

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.host) {
        return url.host;
      }
    } catch (error) {
      continue;
    }
  }

  const host = trimmed.split('/')[0];
  return /^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host) ? host : null;
}

function getAllowedDomains(): string[] {
  const value = process.env.TON_PROOF_ALLOWED_DOMAINS;
  if (!value) {
    const domains = new Set(DEFAULT_ALLOWED_DOMAINS);

    const manifestCandidates = [
      process.env.TON_MANIFEST_URL,
      process.env.TON_MANIFEST,
      process.env.PUBLIC_TON_MANIFEST_URL,
      process.env.PUBLIC_TONCONNECT_MANIFEST_URL,
      process.env.VITE_TON_MANIFEST,
      process.env.VITE_TON_MANIFEST_URL,
      process.env.NEXT_PUBLIC_TON_MANIFEST_URL,
    ];

    for (const candidate of manifestCandidates) {
      const parsed = parseDomainCandidate(candidate);
      if (parsed) {
        domains.add(parsed);
      }
    }

    const deploymentCandidates = [
      process.env.APP_URL,
      process.env.PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_APP_URL,
    ];

    for (const candidate of deploymentCandidates) {
      const parsed = parseDomainCandidate(candidate);
      if (parsed) {
        domains.add(parsed);
      }
    }

    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
    const parsedVercel = parseDomainCandidate(vercelUrl);
    if (parsedVercel) {
      domains.add(parsedVercel);
    }

    return Array.from(domains);
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hashNonce(nonce: string): string {
  const hmac = createHmac('sha256', getHmacSecret());
  hmac.update(nonce);
  return hmac.digest('base64url');
}

function encodeAccessTokenPayload(payload: AccessTokenPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64url');
}

function signAccessTokenSegment(segment: string): string {
  const hmac = createHmac('sha256', getHmacSecret());
  hmac.update(segment);
  return hmac.digest('base64url');
}

function hashAccessToken(token: string): string {
  const hash = createHash('sha256');
  hash.update(token);
  return hash.digest('base64url');
}

function decodeAccessTokenPayload(token: string): AccessTokenPayload | null {
  const [encodedPayload] = token.split('.');
  if (!encodedPayload) {
    return null;
  }
  try {
    const json = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    return JSON.parse(json) as AccessTokenPayload;
  } catch (error) {
    return null;
  }
}

async function getWalletToken(tokenHash: string): Promise<WalletTokenRow | null> {
  const result = await query<WalletTokenRow>(
    `SELECT * FROM wallet_tokens WHERE token_hash = $1 LIMIT 1`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

async function saveWalletTokenRecord({
  tokenHash,
  userId,
  wallet,
  expiresAt,
}: {
  tokenHash: string;
  userId: string;
  wallet: string;
  expiresAt: Date;
}): Promise<void> {
  await query(
    `INSERT INTO wallet_tokens (token_hash, user_id, wallet, expires_at, last_used_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (token_hash)
       DO UPDATE SET user_id = EXCLUDED.user_id, wallet = EXCLUDED.wallet, expires_at = EXCLUDED.expires_at, last_used_at = NOW()`,
    [tokenHash, userId, wallet, expiresAt.toISOString()],
  );
}

async function touchWalletToken(tokenHash: string): Promise<void> {
  await query(`UPDATE wallet_tokens SET last_used_at = NOW() WHERE token_hash = $1`, [tokenHash]).catch(() => {});
}

async function deleteWalletToken(tokenHash: string): Promise<void> {
  await query(`DELETE FROM wallet_tokens WHERE token_hash = $1`, [tokenHash]).catch(() => {});
}

export function createAccessToken(userId: string, wallet: string): string {
  const payload: AccessTokenPayload = {
    userId,
    wallet,
    exp: Math.floor(Date.now() / 1000) + getAccessTokenTtlSeconds(),
  };

  const encoded = encodeAccessTokenPayload(payload);
  const signature = signAccessTokenSegment(encoded);
  return `${encoded}.${signature}`;
}

export async function verifyAccessToken(
  token: string | null | undefined,
  expected: { userId?: string; wallet?: string } = {},
): Promise<AccessTokenPayload> {
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedError('Missing access token');
  }

  const [encodedPayload, providedSignature, ...rest] = token.split('.');
  if (!encodedPayload || !providedSignature || rest.length > 0) {
    throw new UnauthorizedError('Invalid access token');
  }

  let payload: AccessTokenPayload;
  try {
    const json = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    payload = JSON.parse(json) as AccessTokenPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid access token');
  }

  const expectedSignature = signAccessTokenSegment(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature, 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new UnauthorizedError('Invalid access token');
  }

  if (!payload?.userId || !payload?.wallet || typeof payload.exp !== 'number') {
    throw new UnauthorizedError('Invalid access token');
  }

  const tokenHash = hashAccessToken(token);
  const storedToken = await getWalletToken(tokenHash);
  if (!storedToken) {
    throw new UnauthorizedError('Access token revoked');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    await deleteWalletToken(tokenHash);
    throw new UnauthorizedError('Access token expired');
  }

  const storedExpiresAt = storedToken.expires_at instanceof Date
    ? storedToken.expires_at
    : new Date(storedToken.expires_at);
  if (storedExpiresAt.getTime() <= Date.now()) {
    await deleteWalletToken(tokenHash);
    throw new UnauthorizedError('Access token expired');
  }

  if (storedToken.user_id !== payload.userId || storedToken.wallet !== payload.wallet) {
    throw new UnauthorizedError('Invalid access token');
  }

  if (expected.userId && expected.userId !== payload.userId) {
    throw new UnauthorizedError('Access token user mismatch');
  }

  if (expected.wallet && expected.wallet !== payload.wallet) {
    throw new UnauthorizedError('Access token wallet mismatch');
  }

  await touchWalletToken(tokenHash);

  return payload;
}

async function fetchWalletSession(nonceHash: string): Promise<WalletSessionRow | null> {
  const result = await query<WalletSessionRow>(
    `DELETE FROM wallet_sessions WHERE nonce_hash = $1 RETURNING *`,
    [nonceHash],
  );
  return result.rows[0] ?? null;
}

async function saveWalletSession({
  nonceHash,
  ttl,
  userId,
  wallet,
}: {
  nonceHash: string;
  ttl: Date;
  userId?: string | null;
  wallet?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO wallet_sessions (nonce_hash, ttl, user_id, wallet)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (nonce_hash) DO UPDATE SET ttl = EXCLUDED.ttl, user_id = EXCLUDED.user_id, wallet = EXCLUDED.wallet, created_at = NOW()`,
    [nonceHash, ttl.toISOString(), userId ?? null, wallet ?? null],
  );
}

async function findUserByWallet(wallet: string): Promise<UserRow | null> {
  const result = await query<UserRow>(`SELECT * FROM users WHERE wallet = $1 LIMIT 1`, [wallet]);
  return result.rows[0] ?? null;
}

async function upsertWalletUser(userId: string, wallet: string): Promise<UserRow> {
  const now = new Date();
  const result = await query<UserRow>(
    `INSERT INTO users (
       id, wallet, wallet_address, wallet_verified, country_code, energy, boost_level, boost_expires_at,
       created_at, updated_at, last_seen_at, total_earned, total_watches, session_count, daily_watch_count,
       daily_watch_date, claimed_partners, last_watch_at
     )
     VALUES ($1, $2, $2, TRUE, NULL, 0, 0, NULL, $3, $3, $3, 0, 0, 0, 0, NULL, ARRAY[]::TEXT[], NULL)
     ON CONFLICT (id) DO UPDATE SET
       wallet = EXCLUDED.wallet,
       wallet_address = EXCLUDED.wallet_address,
       wallet_verified = TRUE,
       last_seen_at = $3,
       updated_at = $3
     RETURNING *`,
    [userId, wallet, now.toISOString()],
  );
  return result.rows[0];
}

function toBuffer(value: Buffer | string): Buffer {
  return typeof value === 'string' ? Buffer.from(value, 'base64') : value;
}

async function fetchWalletPublicKey(address: string): Promise<Buffer | null> {
  try {
    const client = getTonClient();
    const last = await client.getLastBlock();
    const parsed = Address.parse(address);
    const result = await client.runMethod(last.last.seqno, parsed, 'get_public_key');
    if (result.exitCode !== 0) {
      return null;
    }
    const value = result.reader.readBigNumber();
    const hex = value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
  } catch (error) {
    console.error('[wallet-proof] Failed to fetch wallet public key:', error);
    return null;
  }
}

function ensureAllowedDomain(domain: TonProofDomain, allowedDomains: string[]): void {
  if (!allowedDomains.includes(domain.value)) {
    throw new Error('Proof domain is not allowed');
  }
}

function ensureFreshTimestamp(timestamp: number): void {
  const ttlSeconds = getTtlSeconds();
  const now = Math.floor(Date.now() / 1000);
  if (now - ttlSeconds > timestamp) {
    throw new Error('Proof timestamp expired');
  }
}

async function resolveStateInit(address: string, encoded?: string): Promise<StateInit | null> {
  try {
    if (encoded) {
      return loadStateInit(Cell.fromBase64(encoded).beginParse());
    }

    const client = getTonClient();
    const last = await client.getLastBlock();
    const result = await client.getAccount(last.last.seqno, Address.parse(address));

    if (result.account.state.type !== 'active') {
      return null;
    }

    const code = result.account.state.code ? Cell.fromBase64(result.account.state.code) : null;
    const data = result.account.state.data ? Cell.fromBase64(result.account.state.data) : null;

    if (!code || !data) {
      return null;
    }

    return { code, data };
  } catch (error) {
    console.error('[wallet-proof] Failed to resolve state init:', error);
    return null;
  }
}

async function verifyTonProof(payload: TonProofPayload): Promise<void> {
  const allowedDomains = getAllowedDomains();
  ensureAllowedDomain(payload.proof.domain, allowedDomains);
  ensureFreshTimestamp(payload.proof.timestamp);

  const resolvedAddress = Address.parse(payload.address);
  const stateInit = await resolveStateInit(payload.address, payload.proof.state_init);
  const publicKey = await fetchWalletPublicKey(payload.address);

  let expectedPublicKey = publicKey;

  if (!publicKey && stateInit) {
    const parsed = tryParsePublicKey(stateInit);
    if (parsed) {
      expectedPublicKey = parsed;
    }
  }

  if (!expectedPublicKey) {
    throw new Error('Unable to resolve wallet public key');
  }

  const workchain = Buffer.alloc(4);
  workchain.writeInt32BE(resolvedAddress.workChain, 0);

  const addressBuffer = resolvedAddress.hash;
  const domainLength = Buffer.alloc(4);
  domainLength.writeUInt32BE(payload.proof.domain.lengthBytes, 0);

  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigUInt64LE(BigInt(payload.proof.timestamp), 0);

  const messageBuffer = Buffer.concat([
    Buffer.from(TON_PROOF_PREFIX),
    workchain,
    addressBuffer,
    domainLength,
    Buffer.from(payload.proof.domain.value),
    timestampBuffer,
    Buffer.from(payload.proof.payload),
  ]);

  const messageHash = Buffer.from(await sha256(messageBuffer));
  const fullMessage = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from(TON_CONNECT_PREFIX),
    messageHash,
  ]);

  const finalHash = Buffer.from(await sha256(fullMessage));
  const signature = toBuffer(payload.proof.signature);

  const isValid = nacl.sign.detached.verify(finalHash, signature, expectedPublicKey);
  if (!isValid) {
    throw new Error('Invalid TON proof signature');
  }
}

export async function startWalletProofSession(options: WalletProofSessionOptions = {}): Promise<WalletProofStartResult> {
  const nonceBytes = await getSecureRandomBytes(32);
  const nonce = Buffer.from(nonceBytes).toString('base64url');
  const ttlSeconds = getTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const nonceHash = hashNonce(nonce);

  await saveWalletSession({
    nonceHash,
    ttl: expiresAt,
    userId: options.userId ?? null,
    wallet: options.wallet ?? null,
  });

  return {
    nonce,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function finishWalletProofSession(input: WalletProofFinishInput): Promise<WalletProofFinishResult> {
  if (input.chain !== 'ton-mainnet') {
    throw new Error('Only TON mainnet is supported');
  }

  const nonceValue = input.nonce ?? input.proof.payload;
  if (!nonceValue) {
    throw new Error('Missing proof payload');
  }

  const nonceHash = hashNonce(nonceValue);
  const session = await fetchWalletSession(nonceHash);
  if (!session) {
    throw new Error('Proof session expired or unknown');
  }

  const ttl = session.ttl instanceof Date ? session.ttl : new Date(session.ttl);
  if (ttl.getTime() < Date.now()) {
    throw new Error('Proof session expired');
  }

  if (input.proof.payload !== nonceValue) {
    throw new Error('Proof payload mismatch');
  }

  const address = input.rawAddress ?? input.address;
  if (session.wallet && session.wallet !== address) {
    throw new Error('Wallet address does not match session');
  }

  if (session.user_id && input.userId && session.user_id !== input.userId) {
    throw new Error('Wallet session user mismatch');
  }

  const userId = input.userId ?? session.user_id ?? Address.parse(address).toString();

  const payload: TonProofPayload = {
    address,
    network: 'ton-mainnet',
    public_key: input.publicKey,
    proof: {
      timestamp: input.proof.timestamp,
      domain: input.proof.domain,
      payload: input.proof.payload,
      signature: input.proof.signature,
      state_init: input.proof.state_init,
    },
  };

  await verifyTonProof(payload);

  const wallet = Address.parse(address).toString();

  const existing = await findUserByWallet(wallet);
  if (existing && existing.id !== userId) {
    throw new Error('Wallet already associated with another user');
  }

  const userRow = await upsertWalletUser(userId, wallet);

  const accessToken = createAccessToken(userRow.id, wallet);
  const decodedPayload = decodeAccessTokenPayload(accessToken);
  if (!decodedPayload) {
    throw new Error('Failed to encode access token');
  }
  const tokenHash = hashAccessToken(accessToken);
  const expiresAt = new Date(decodedPayload.exp * 1000);
  const resolvedWallet = userRow.wallet ?? wallet;
  await saveWalletTokenRecord({
    tokenHash,
    userId: userRow.id,
    wallet: resolvedWallet,
    expiresAt,
  });

  return {
    success: true,
    userId: userRow.id,
    wallet: userRow.wallet ?? wallet,
    accessToken,
  };
}

const knownWallets = [
  { contract: WalletContractV1R1, loader: loadWalletV1 },
  { contract: WalletContractV1R2, loader: loadWalletV1 },
  { contract: WalletContractV1R3, loader: loadWalletV1 },
  { contract: WalletContractV2R1, loader: loadWalletV2 },
  { contract: WalletContractV2R2, loader: loadWalletV2 },
  { contract: WalletContractV3R1, loader: loadWalletV3 },
  { contract: WalletContractV3R2, loader: loadWalletV3 },
  { contract: WalletContractV4, loader: loadWalletV4 },
  { contract: WalletContractV5Beta, loader: loadWalletV5 },
  { contract: WalletContractV5R1, loader: loadWalletV5 },
];

function loadWalletV1(cs: Slice) {
  cs.loadUint(32); // seqno
  return { publicKey: cs.loadBuffer(32) };
}

function loadWalletV2(cs: Slice) {
  cs.loadUint(32);
  return { publicKey: cs.loadBuffer(32) };
}

function loadWalletV3(cs: Slice) {
  cs.loadUint(32);
  cs.loadUint(32);
  return { publicKey: cs.loadBuffer(32) };
}

function loadWalletV4(cs: Slice) {
  cs.loadUint(32);
  cs.loadUint(32);
  const publicKey = cs.loadBuffer(32);
  cs.loadMaybeRef();
  return { publicKey };
}

function loadWalletV5(cs: Slice) {
  cs.loadBoolean();
  cs.loadUint(32);
  cs.loadUint(32);
  const publicKey = cs.loadBuffer(32);
  cs.loadMaybeRef();
  return { publicKey };
}

function tryParsePublicKey(stateInit: StateInit): Buffer | null {
  if (!stateInit.code || !stateInit.data) {
    return null;
  }

  for (const { contract, loader } of knownWallets) {
    try {
      const wallet = contract.create({ workchain: 0, publicKey: Buffer.alloc(32) });
      if (wallet.init.code?.equals(stateInit.code)) {
        return loader(stateInit.data.beginParse()).publicKey;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}
