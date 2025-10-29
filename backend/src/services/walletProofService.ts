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
import type { QueryResultRow } from 'pg';

import { UnauthorizedError } from '../errors';
import { query } from '../postgres';
import { getCorsAllowedOrigins } from '../config';

const TON_PROOF_PREFIX = 'ton-proof-item-v2/';
const TON_CONNECT_PREFIX = 'ton-connect';
const DEV_FALLBACK_SECRET = 'insecure-dev-ton-connect-secret';
const DEFAULT_PROOF_TTL_SECONDS = 60 * 15;
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24;

const DEFAULT_ALLOWED_DOMAINS = [
  'localhost:5173',
  '127.0.0.1:5173',
  'localhost:4173',
  '127.0.0.1:4173',
  'ton-connect.github.io',
  'cladhunter-ai-frontend.vercel.app',
  'cladhinter-ai-frontend.vercel.app',
  't.me',
];

interface TonProofDomain {
  lengthBytes: number;
  value: string;
}

interface TonProofPayload {
  address: string;
  network: string;
  public_key: string;
  proof: {
    domain: TonProofDomain;
    payload: string;
    signature: string;
    timestamp: number;
    state_init?: string;
  };
}

interface WalletSessionRow extends QueryResultRow {
  nonce_hash: string;
  user_id: string | null;
  wallet: string | null;
  domain: string | null;
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
}

export interface WalletProofStartResult {
  nonce: string;
  expiresAt: string;
}

export interface WalletProofSessionOptions {
  userId?: string | null;
  wallet?: string | null;
  domain?: string | null;
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
  wallet: string;
  userId: string;
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

  const endpoint = process.env.TON_MAINNET_RPC ?? 'https://mainnet-v4.tonhubapi.com';
  const params: TonClient4Parameters = { endpoint };
  tonClient = new TonClient4(params);
  return tonClient;
}

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

function getHmacSecret(): string {
  const secret = process.env.SERVER_HMAC_SECRET?.trim();
  if (secret) {
    return secret;
  }
  if (!isProduction()) {
    return DEV_FALLBACK_SECRET;
  }
  throw new Error('SERVER_HMAC_SECRET must be configured');
}

function getProofTtlSeconds(): number {
  const raw = process.env.WALLET_PROOF_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_PROOF_TTL_SECONDS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROOF_TTL_SECONDS;
}

function getAccessTokenTtlSeconds(): number {
  const raw = process.env.ACCESS_TOKEN_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_TOKEN_TTL_SECONDS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOKEN_TTL_SECONDS;
}

function normalizeDomain(value: string): string {
  return value.trim().replace(/\.+$/u, '').toLowerCase();
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
    } catch {
      continue;
    }
  }

  const head = trimmed.split('/')[0];
  return /^[a-zA-Z0-9.-]+(?::\d+)?$/.test(head) ? head : null;
}

function collectAllowedDomains(): string[] {
  const domains = new Set(DEFAULT_ALLOWED_DOMAINS.map((item) => normalizeDomain(item)));

  const rawEnv = process.env.TON_PROOF_ALLOWED_DOMAINS;
  if (rawEnv) {
    for (const part of rawEnv.split(',')) {
      const parsed = parseDomainCandidate(part);
      if (parsed) {
        domains.add(normalizeDomain(parsed));
      }
    }
  }

  for (const origin of getCorsAllowedOrigins()) {
    const parsed = parseDomainCandidate(origin);
    if (parsed) {
      domains.add(normalizeDomain(parsed));
    }
  }

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
      domains.add(normalizeDomain(parsed));
    }
  }

  const appCandidates = [
    process.env.APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];
  for (const candidate of appCandidates) {
    const parsed = parseDomainCandidate(candidate);
    if (parsed) {
      domains.add(normalizeDomain(parsed));
    }
  }

  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  const parsedVercel = parseDomainCandidate(vercelUrl);
  if (parsedVercel) {
    domains.add(normalizeDomain(parsedVercel));
  }

  return Array.from(domains);
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
  const [encoded] = token.split('.');
  if (!encoded) {
    return null;
  }

  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
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

async function saveWalletToken({
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
     ON CONFLICT (token_hash) DO UPDATE SET user_id = EXCLUDED.user_id, wallet = EXCLUDED.wallet, expires_at = EXCLUDED.expires_at, last_used_at = NOW()`,
    [tokenHash, userId, wallet, expiresAt.toISOString()],
  );
}

async function touchWalletToken(tokenHash: string): Promise<void> {
  await query(`UPDATE wallet_tokens SET last_used_at = NOW() WHERE token_hash = $1`, [tokenHash]).catch(
    () => {},
  );
}

async function deleteWalletToken(tokenHash: string): Promise<void> {
  await query(`DELETE FROM wallet_tokens WHERE token_hash = $1`, [tokenHash]).catch(() => {});
}

async function consumeWalletSession(nonceHash: string): Promise<WalletSessionRow | null> {
  const result = await query<WalletSessionRow>(
    `DELETE FROM wallet_sessions WHERE nonce_hash = $1 RETURNING *`,
    [nonceHash],
  );
  return result.rows[0] ?? null;
}

async function storeWalletSession({
  nonceHash,
  ttl,
  userId,
  wallet,
  domain,
}: {
  nonceHash: string;
  ttl: Date;
  userId?: string | null;
  wallet?: string | null;
  domain?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO wallet_sessions (nonce_hash, ttl, user_id, wallet, domain)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (nonce_hash) DO UPDATE SET ttl = EXCLUDED.ttl, user_id = EXCLUDED.user_id, wallet = EXCLUDED.wallet, domain = EXCLUDED.domain, created_at = NOW()`,
    [nonceHash, ttl.toISOString(), userId ?? null, wallet ?? null, domain ?? null],
  );
}

async function findUserByWallet(wallet: string): Promise<UserRow | null> {
  const result = await query<UserRow>(`SELECT * FROM users WHERE wallet = $1 LIMIT 1`, [wallet]);
  return result.rows[0] ?? null;
}

async function upsertWalletUser(userId: string, wallet: string): Promise<UserRow> {
  const now = new Date().toISOString();
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
    [userId, wallet, now],
  );
  return result.rows[0];
}

function ensureDomainAllowed(
  domain: TonProofDomain,
  allowed: string[],
  expected?: string | null,
): void {
  const normalizedExpected = expected ? normalizeDomain(expected) : null;
  const normalizedDomain = normalizeDomain(domain.value);
  const actualLength = Buffer.from(domain.value, 'utf8').length;

  if (domain.lengthBytes !== actualLength) {
    throw new Error('Proof domain length mismatch');
  }

  const allowlist = new Set(allowed.map((item) => normalizeDomain(item)));
  if (normalizedExpected) {
    allowlist.add(normalizedExpected);
  }

  if (!allowlist.has(normalizedDomain)) {
    throw new Error('Proof domain is not allowed');
  }

  if (normalizedExpected && normalizedDomain !== normalizedExpected) {
    throw new Error('Proof domain mismatch');
  }
}

function ensureTimestampFresh(timestamp: number): void {
  const ttl = getProofTtlSeconds();
  const now = Math.floor(Date.now() / 1000);
  if (timestamp < now - ttl) {
    throw new Error('Proof timestamp expired');
  }
}

function normalizePublicKey(value: string | null | undefined): Buffer | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase().replace(/^0x/u, '');
  if (trimmed.length !== 64 || !/^[0-9a-f]+$/u.test(trimmed)) {
    return null;
  }
  return Buffer.from(trimmed, 'hex');
}

async function fetchStateInit(address: string): Promise<StateInit | null> {
  try {
    const client = getTonClient();
    const last = await client.getLastBlock();
    const account = await client.getAccount(last.last.seqno, Address.parse(address));
    if (account.account.state.type !== 'active') {
      return null;
    }
    const code = account.account.state.code ? Cell.fromBase64(account.account.state.code) : null;
    const data = account.account.state.data ? Cell.fromBase64(account.account.state.data) : null;
    if (!code || !data) {
      return null;
    }
    return { code, data };
  } catch {
    return null;
  }
}

const KNOWN_WALLETS = [
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
] as const;

function loadWalletV1(slice: Slice) {
  slice.loadUint(32);
  return { publicKey: slice.loadBuffer(32) };
}

function loadWalletV2(slice: Slice) {
  slice.loadUint(32);
  return { publicKey: slice.loadBuffer(32) };
}

function loadWalletV3(slice: Slice) {
  slice.loadUint(32);
  slice.loadUint(32);
  return { publicKey: slice.loadBuffer(32) };
}

function loadWalletV4(slice: Slice) {
  slice.loadUint(32);
  slice.loadUint(32);
  const publicKey = slice.loadBuffer(32);
  slice.loadMaybeRef();
  return { publicKey };
}

function loadWalletV5(slice: Slice) {
  slice.loadBoolean();
  slice.loadUint(32);
  slice.loadUint(32);
  const publicKey = slice.loadBuffer(32);
  slice.loadMaybeRef();
  return { publicKey };
}

function tryParsePublicKey(state: StateInit): Buffer | null {
  if (!state.code || !state.data) {
    return null;
  }

  for (const { contract, loader } of KNOWN_WALLETS) {
    try {
      const wallet = contract.create({ workchain: 0, publicKey: Buffer.alloc(32) });
      if (wallet.init.code?.equals(state.code)) {
        return loader(state.data.beginParse()).publicKey;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractPublicKeyFromStateInit(stateInit?: string | null): Buffer | null {
  if (!stateInit) {
    return null;
  }

  try {
    const cell = Cell.fromBase64(stateInit);
    const state = loadStateInit(cell.beginParse());
    return tryParsePublicKey(state);
  } catch {
    return null;
  }
}

async function resolvePublicKey(
  address: string,
  proof: { state_init?: string; publicKey: string },
): Promise<Buffer> {
  const fromProof = extractPublicKeyFromStateInit(proof.state_init);
  if (fromProof) {
    return fromProof;
  }

  const normalizedProofKey = normalizePublicKey(proof.publicKey);
  const fromChainState = await fetchStateInit(address);
  const fromChain = fromChainState ? tryParsePublicKey(fromChainState) : null;

  if (fromChain) {
    if (normalizedProofKey && !normalizedProofKey.equals(fromChain)) {
      throw new Error('Public key mismatch');
    }
    return fromChain;
  }

  if (normalizedProofKey) {
    return normalizedProofKey;
  }

  throw new Error('Unable to resolve wallet public key');
}

async function verifyTonProof(
  payload: TonProofPayload,
  options: { expectedDomain?: string | null } = {},
): Promise<void> {
  const allowedDomains = collectAllowedDomains();
  const proofDomainNormalized = normalizeDomain(payload.proof.domain.value);
  const expectedDomainNormalized = options.expectedDomain
    ? normalizeDomain(options.expectedDomain)
    : null;
  const enforcedExpectedDomain =
    expectedDomainNormalized && expectedDomainNormalized === proofDomainNormalized
      ? options.expectedDomain
      : null;
  ensureDomainAllowed(payload.proof.domain, allowedDomains, enforcedExpectedDomain);
  ensureTimestampFresh(payload.proof.timestamp);

  const resolvedAddress = Address.parse(payload.address);
  const publicKey = await resolvePublicKey(payload.address, {
    state_init: payload.proof.state_init,
    publicKey: payload.public_key,
  });

  const workchain = Buffer.alloc(4);
  workchain.writeInt32BE(resolvedAddress.workChain, 0);

  const addressHash = resolvedAddress.hash;
  const domainLength = Buffer.alloc(4);
  domainLength.writeUInt32BE(payload.proof.domain.lengthBytes, 0);

  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigUInt64LE(BigInt(payload.proof.timestamp), 0);

  const message = Buffer.concat([
    Buffer.from(TON_PROOF_PREFIX),
    workchain,
    addressHash,
    domainLength,
    Buffer.from(payload.proof.domain.value, 'utf8'),
    timestampBuffer,
    Buffer.from(payload.proof.payload, 'utf8'),
  ]);

  const messageHash = Buffer.from(await sha256(message));
  const fullMessage = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from(TON_CONNECT_PREFIX),
    messageHash,
  ]);

  const finalHash = Buffer.from(await sha256(fullMessage));
  const signature = Buffer.from(payload.proof.signature, 'base64');

  const valid = nacl.sign.detached.verify(finalHash, signature, publicKey);
  if (!valid) {
    throw new Error('Invalid TON proof signature');
  }
}

export async function startWalletProofSession(
  options: WalletProofSessionOptions = {},
): Promise<WalletProofStartResult> {
  const nonceBytes = await getSecureRandomBytes(32);
  const nonce = Buffer.from(nonceBytes).toString('base64url');
  const ttlSeconds = getProofTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const nonceHash = hashNonce(nonce);
  const domainCandidate = parseDomainCandidate(options.domain);
  const normalizedDomain = domainCandidate ? normalizeDomain(domainCandidate) : null;

  await storeWalletSession({
    nonceHash,
    ttl: expiresAt,
    userId: options.userId ?? null,
    wallet: options.wallet ?? null,
    domain: normalizedDomain,
  });

  return {
    nonce,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function finishWalletProofSession(
  input: WalletProofFinishInput,
): Promise<WalletProofFinishResult> {
  if (input.chain !== 'ton-mainnet') {
    throw new Error('Only TON mainnet is supported');
  }

  const payloadValue = input.nonce || input.proof.payload;
  if (!payloadValue) {
    throw new Error('Missing proof payload');
  }

  const nonceHash = hashNonce(payloadValue);
  const session = await consumeWalletSession(nonceHash);
  if (!session) {
    throw new Error('Proof session expired or unknown');
  }

  const ttl = session.ttl instanceof Date ? session.ttl : new Date(session.ttl);
  if (ttl.getTime() < Date.now()) {
    throw new Error('Proof session expired');
  }

  if (session.wallet && session.wallet !== (input.rawAddress ?? input.address)) {
    throw new Error('Wallet address does not match session');
  }

  if (session.user_id && input.userId && session.user_id !== input.userId) {
    throw new Error('Wallet session user mismatch');
  }

  const expectedDomain = session.domain ?? null;
  const payload: TonProofPayload = {
    address: input.rawAddress ?? input.address,
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

  await verifyTonProof(payload, { expectedDomain });

  const walletAddress = Address.parse(payload.address).toString();
  const existing = await findUserByWallet(walletAddress);
  if (existing && existing.id !== (input.userId ?? session.user_id ?? walletAddress)) {
    throw new Error('Wallet already associated with another user');
  }

  const userId = input.userId ?? session.user_id ?? walletAddress;
  const user = await upsertWalletUser(userId, walletAddress);

  const accessToken = createAccessToken(user.id, walletAddress);
  const payloadDecoded = decodeAccessTokenPayload(accessToken);
  if (!payloadDecoded) {
    throw new Error('Failed to encode access token');
  }

  const tokenHash = hashAccessToken(accessToken);
  const expiresAt = new Date(payloadDecoded.exp * 1000);
  await saveWalletToken({
    tokenHash,
    userId: user.id,
    wallet: walletAddress,
    expiresAt,
  });

  return {
    success: true,
    wallet: walletAddress,
    userId: user.id,
    accessToken,
  };
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
  } catch {
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

  if (!payload.userId || !payload.wallet || typeof payload.exp !== 'number') {
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

  if (expected.userId && expected.userId !== payload.userId) {
    throw new UnauthorizedError('Access token user mismatch');
  }

  if (expected.wallet && expected.wallet !== payload.wallet) {
    throw new UnauthorizedError('Access token wallet mismatch');
  }

  await touchWalletToken(tokenHash);

  return payload;
}

export const __testables = {
  parseDomainCandidate,
  normalizeDomain,
  collectAllowedDomains,
  hashNonce,
};
