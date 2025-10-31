import { Cell } from '@ton/core';

import { getTonApiConfig, getMerchantWalletAddress } from '../config';

interface VerifyTonTransferInput {
  txHash: string;
  amountTon?: number;
  destination?: string;
}

interface TonMessage {
  value?: string;
  destination?: {
    address?: string;
  };
  source?: {
    address?: string;
  };
  message?: string;
}

interface TonTransaction {
  hash: string;
  in_msg?: TonMessage;
  out_msgs?: TonMessage[];
  account_tx?: {
    account?: string;
  };
}

const HEX_HASH_REGEX = /^[a-f0-9]{64}$/iu;
const BASE64_LIKE_REGEX = /^[A-Za-z0-9+/=_-]+$/u;

function tonToNano(ton: number): bigint {
  return BigInt(Math.round(ton * 1_000_000_000));
}

function normalizeAddress(address?: string | null): string | null {
  if (!address) {
    return null;
  }
  return address.trim();
}

function toBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

function toBase64Url(buffer: Buffer): string {
  return toBase64(buffer).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=/gu, '');
}

function decodeBase64Buffer(raw: string): Buffer | null {
  const needsPadding = raw.length % 4;
  let normalized = raw.replace(/-/gu, '+').replace(/_/gu, '/');
  if (needsPadding) {
    normalized = normalized.padEnd(normalized.length + (4 - needsPadding), '=');
  }
  try {
    return Buffer.from(normalized, 'base64');
  } catch {
    return null;
  }
}

function lookupHashesFromCanonical(hexHash: string): string[] {
  const buffer = Buffer.from(hexHash, 'hex');
  return Array.from(
    new Set<string>([hexHash, toBase64Url(buffer), toBase64(buffer)]),
  );
}

export function canonicalizeTransactionHash(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Invalid TON transaction hash format');
  }

  if (HEX_HASH_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (BASE64_LIKE_REGEX.test(trimmed)) {
    const decoded = decodeBase64Buffer(trimmed);
    if (decoded) {
      if (decoded.length === 32) {
        return decoded.toString('hex');
      }

      try {
        const cells = Cell.fromBoc(decoded);
        if (cells.length > 0) {
          const hashBuffer = Buffer.from(cells[0].hash());
          return hashBuffer.toString('hex');
        }
      } catch {
        // ignore and fall through to error below
      }
    }
  }

  throw new Error('Invalid TON transaction hash format');
}

async function fetchTonTransaction(txHash: string): Promise<TonTransaction | null> {
  const { baseUrl, apiKey } = getTonApiConfig();
  const base = baseUrl.replace(/\/+$/u, '');

  const response = await fetch(`${base}/v2/blockchain/transactions/${txHash}`, {
    headers: apiKey
      ? {
          Authorization: `Bearer ${apiKey}`,
        }
      : undefined,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch TON transaction: ${response.status} ${body}`);
  }

  const data = (await response.json()) as TonTransaction;
  return data;
}

export async function verifyTonTransfer({
  txHash,
  amountTon,
  destination,
}: VerifyTonTransferInput): Promise<boolean> {
  const canonical = canonicalizeTransactionHash(txHash);
  const lookupHashes = lookupHashesFromCanonical(canonical);

  const normalizedDestination =
    normalizeAddress(destination) ?? normalizeAddress(getMerchantWalletAddress());

  let tx: TonTransaction | null = null;
  for (const candidate of lookupHashes) {
    tx = await fetchTonTransaction(candidate);
    if (tx) {
      break;
    }
  }

  if (!tx) {
    return false;
  }

  const messages: TonMessage[] = [
    ...(tx.out_msgs ?? []),
    ...(tx.in_msg ? [tx.in_msg] : []),
  ];

  const expectedAmount = amountTon != null ? tonToNano(amountTon) : null;

  for (const message of messages) {
    const msgAmount = message.value ? BigInt(message.value) : null;
    const msgDestination = normalizeAddress(message.destination?.address);
    if (!msgAmount || !msgDestination) {
      continue;
    }

    if (normalizedDestination && msgDestination !== normalizedDestination) {
      continue;
    }

    if (expectedAmount && msgAmount < expectedAmount) {
      continue;
    }

    return true;
  }

  return false;
}
