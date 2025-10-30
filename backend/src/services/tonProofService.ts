import { getSecureRandomBytes, sha256 } from '@ton/crypto';
import { Address, Cell, contractAddress, loadStateInit } from '@ton/ton';
import { Buffer } from 'buffer';
import { sign } from 'tweetnacl';

export interface TonProofPayload {
  address: string;
  network: number | string;
  publicKey: string;
  stateInit?: string | null;
  proof: {
    timestamp: number;
    domain: {
      value: string;
      lengthBytes: number;
    };
    signature: string;
    payload: string;
    state_init?: string | null;
  };
}

export interface TonProofVerificationOptions {
  allowedDomains: string[];
  maxAgeSeconds: number;
}

export interface TonProofVerificationResult {
  ok: boolean;
  walletAddress?: string;
  publicKey?: string;
}

function toBase64Buffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

export async function verifyTonProof(
  payload: TonProofPayload,
  options: TonProofVerificationOptions,
): Promise<TonProofVerificationResult> {
  try {
    const domain = payload.proof.domain.value.trim().toLowerCase();
    if (!options.allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
      return { ok: false };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - payload.proof.timestamp > options.maxAgeSeconds) {
      return { ok: false };
    }

    const parsedAddress = Address.parse(payload.address);
    const normalizedAddress = parsedAddress.toString({
      urlSafe: true,
      bounceable: false,
    });

    const stateInitBoc = payload.stateInit ?? payload.proof.state_init;
    if (!stateInitBoc) {
      return { ok: false };
    }

    const stateInit = loadStateInit(Cell.fromBase64(stateInitBoc).beginParse());
    const derivedAddress = contractAddress(parsedAddress.workChain, stateInit);
    if (!derivedAddress.equals(parsedAddress)) {
      return { ok: false };
    }

    const wc = Buffer.alloc(4);
    wc.writeInt32BE(parsedAddress.workChain, 0);

    const domainLength = Buffer.alloc(4);
    domainLength.writeUInt32LE(payload.proof.domain.lengthBytes, 0);

    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigUInt64LE(BigInt(payload.proof.timestamp), 0);

    const proofPayload = Buffer.from(payload.proof.payload, 'utf8');
    const signature = toBase64Buffer(payload.proof.signature);
    const publicKey = Buffer.from(payload.publicKey, 'hex');

    const message = Buffer.concat([
      Buffer.from('ton-proof-item-v2/'),
      wc,
      parsedAddress.hash,
      domainLength,
      Buffer.from(payload.proof.domain.value, 'utf8'),
      timestampBuffer,
      proofPayload,
    ]);

    const messageHash = Buffer.from(await sha256(message));
    const fullMessage = Buffer.concat([
      Buffer.from([0xff, 0xff]),
      Buffer.from('ton-connect'),
      messageHash,
    ]);
    const signatureMessage = Buffer.from(await sha256(fullMessage));

    const ok = sign.detached.verify(signatureMessage, signature, publicKey);
    if (!ok) {
      return { ok: false };
    }

    return {
      ok: true,
      walletAddress: normalizedAddress,
      publicKey: payload.publicKey,
    };
  } catch (error) {
    return { ok: false };
  }
}

export async function generateTonProofPayload(): Promise<string> {
  const random = await getSecureRandomBytes(32);
  return Buffer.from(random).toString('base64');
}
