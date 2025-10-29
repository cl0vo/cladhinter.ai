import { getTonApiConfig, getMerchantWalletAddress } from '../config';

interface VerifyTonTransferInput {
  txHash: string;
  amountTon?: number;
  destination?: string;
}

interface TonTransaction {
  hash: string;
  in_msg?: {
    value?: string;
    destination?: {
      address?: string;
    };
  };
  out_msgs?: Array<{
    value?: string;
    destination?: {
      address?: string;
    };
  }>;
  account_tx?: {
    account?: string;
  };
}

function tonToNano(ton: number): bigint {
  return BigInt(Math.round(ton * 1_000_000_000));
}

function normalizeAddress(address?: string | null): string | null {
  if (!address) {
    return null;
  }
  return address.trim();
}

async function fetchTonTransaction(txHash: string): Promise<TonTransaction | null> {
  const { baseUrl, apiKey } = getTonApiConfig();
  const url = `${baseUrl.replace(/\/+$/u, '')}/v2/blockchain/transactions/${txHash}`;

  const response = await fetch(url, {
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
  const normalizedDestination =
    normalizeAddress(destination) ?? normalizeAddress(getMerchantWalletAddress());

  const tx = await fetchTonTransaction(txHash);
  if (!tx) {
    return false;
  }

  const candidates = [
    ...(tx.out_msgs ?? []),
    ...(tx.in_msg ? [tx.in_msg] : []),
  ];

  const expectedAmount = amountTon != null ? tonToNano(amountTon) : null;

  for (const msg of candidates) {
    const msgAmount = msg.value ? BigInt(msg.value) : null;
    const msgDestination = normalizeAddress(msg.destination?.address);
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
