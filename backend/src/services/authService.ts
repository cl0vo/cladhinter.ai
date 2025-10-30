import { createHash, randomBytes } from 'node:crypto';

import { customAlphabet } from 'nanoid';

import { query, withTransaction } from '../db';

const nanoId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
const TOKEN_BYTES = 32;

function generateUserId(): string {
  return `usr_${nanoId()}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface WalletSession {
  userId: string;
  accessToken: string;
  walletAddress: string;
}

export async function createWalletSession(walletAddress: string): Promise<WalletSession> {
  const normalized = walletAddress;

  const { userId, accessToken } = await withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE wallet_address = $1`,
      [normalized],
    );
    let userId = existing.rows[0]?.id ?? null;
    if (!userId) {
      userId = generateUserId();
      try {
        await client.query(
          `INSERT INTO users (id, wallet_address, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())`,
          [userId, normalized],
        );
      } catch (error) {
        const isUniqueViolation =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === '23505';
        if (!isUniqueViolation) {
          throw error;
        }

        const retry = await client.query<{ id: string }>(
          `SELECT id FROM users WHERE wallet_address = $1`,
          [normalized],
        );
        userId = retry.rows[0]?.id ?? userId;
      }
    } else {
      await client.query(
        `UPDATE users
           SET updated_at = NOW()
         WHERE id = $1`,
        [userId],
      );
    }

    const accessToken = randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(accessToken);

    await client.query(
      `INSERT INTO user_tokens (token_hash, user_id, created_at, last_used_at)
       VALUES ($1, $2, NOW(), NOW())`,
      [tokenHash, userId],
    );

    return { userId, accessToken };
  });

  return { userId, accessToken, walletAddress: normalized };
}

export async function verifyAccessToken(userId: string, accessToken: string): Promise<boolean> {
  if (!userId || !accessToken) {
    return false;
  }

  const tokenHash = hashToken(accessToken);
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM user_tokens WHERE token_hash = $1`,
    [tokenHash],
  );

  const record = result.rows[0];
  if (!record || record.user_id !== userId) {
    return false;
  }

  await query(`UPDATE user_tokens SET last_used_at = NOW() WHERE token_hash = $1`, [tokenHash]);

  return true;
}
