import { createHmac } from 'node:crypto';

import { getSecureRandomBytes, sha256 } from '@ton/crypto';
import {
  Address,
  Cell,
  contractAddress,
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

import { SessionModel } from '../models/Session';
import { UserModel } from '../models/User';

const TON_PROOF_PREFIX = 'ton-proof-item-v2/';
const TON_CONNECT_PREFIX = 'ton-connect';

const DEFAULT_ALLOWED_DOMAINS = ['localhost:5173', 'ton-connect.github.io'];
const DEFAULT_TON_ENDPOINT = 'https://mainnet-v4.tonhubapi.com';

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

function getHmacSecret(): string {
  const secret = process.env.SERVER_HMAC_SECRET;
  if (!secret) {
    throw new Error('SERVER_HMAC_SECRET is not configured');
  }
  return secret;
}

function getTtlSeconds(): number {
  const raw = process.env.WALLET_PROOF_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : 15 * 60;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60;
}

function getAllowedDomains(): string[] {
  const value = process.env.TON_PROOF_ALLOWED_DOMAINS;
  if (!value) {
    return DEFAULT_ALLOWED_DOMAINS;
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
  if (payload.network !== 'ton-mainnet') {
    throw new Error('Unsupported TON network');
  }

  const allowedDomains = getAllowedDomains();
  ensureAllowedDomain(payload.proof.domain, allowedDomains);
  ensureFreshTimestamp(payload.proof.timestamp);

  const stateInit = await resolveStateInit(payload.address, payload.proof.state_init);

  const resolvedAddress = Address.parse(payload.address);
  let publicKey = stateInit ? tryParsePublicKey(stateInit) : null;

  if (!publicKey) {
    publicKey = await fetchWalletPublicKey(payload.address);
  }

  if (!publicKey) {
    throw new Error('Unable to resolve wallet public key');
  }

  const expectedPublicKey = Buffer.from(payload.public_key, 'hex');
  if (!publicKey.equals(expectedPublicKey)) {
    throw new Error('Wallet public key mismatch');
  }

  if (stateInit) {
    const derived = contractAddress(resolvedAddress.workChain, stateInit);
    if (!derived.equals(resolvedAddress)) {
      throw new Error('State init does not match wallet address');
    }
  }

  const workchain = Buffer.alloc(4);
  workchain.writeUInt32BE(resolvedAddress.workChain, 0);

  const domainLength = Buffer.alloc(4);
  domainLength.writeUInt32LE(payload.proof.domain.lengthBytes, 0);

  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigUInt64LE(BigInt(payload.proof.timestamp), 0);

  const messageBuffer = Buffer.concat([
    Buffer.from(TON_PROOF_PREFIX),
    workchain,
    resolvedAddress.hash,
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
  const signature = Buffer.from(payload.proof.signature, 'base64');

  const isValid = nacl.sign.detached.verify(finalHash, signature, publicKey);
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

  await SessionModel.create({
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
  const session = await SessionModel.findOne({ nonceHash });
  if (!session) {
    throw new Error('Proof session expired or unknown');
  }

  if (session.ttl.getTime() < Date.now()) {
    await session.deleteOne();
    throw new Error('Proof session expired');
  }

  await session.deleteOne();

  if (input.proof.payload !== nonceValue) {
    throw new Error('Proof payload mismatch');
  }

  const address = input.rawAddress ?? input.address;
  if (session.wallet && session.wallet !== address) {
    throw new Error('Wallet address does not match session');
  }

  if (session.userId && input.userId && session.userId !== input.userId) {
    throw new Error('Wallet session user mismatch');
  }

  const userId = input.userId ?? session.userId ?? Address.parse(address).toString();

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
  const now = new Date();

  const existing = await UserModel.findOne({ wallet });
  if (existing && existing._id !== userId) {
    throw new Error('Wallet already associated with another user');
  }

  const user = await UserModel.findByIdAndUpdate(
    userId,
    {
      wallet,
      walletAddress: wallet,
      walletVerified: true,
      lastSeenAt: now,
      $setOnInsert: {
        _id: userId,
        energy: 0,
        boostLevel: 0,
        sessionCount: 0,
        totalEarned: 0,
        totalWatches: 0,
        dailyWatchCount: 0,
        claimedPartners: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (!user) {
    throw new Error('Failed to upsert user');
  }

  return {
    success: true,
    userId: user._id,
    wallet: user.wallet ?? wallet,
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

