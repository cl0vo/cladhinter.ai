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

export interface AnonymousSession {
  userId: string;
  accessToken: string;
}

export async function createAnonymousSession(): Promise<AnonymousSession> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const userId = generateUserId();
    const accessToken = randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(accessToken);

    try {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO users (id, created_at, updated_at)
           VALUES ($1, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [userId],
        );

        await client.query(
          `INSERT INTO user_tokens (token_hash, user_id, created_at, last_used_at)
           VALUES ($1, $2, NOW(), NOW())`,
          [tokenHash, userId],
        );
      });

      return { userId, accessToken };
    } catch (error) {
      const isUniqueViolation = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
      if (!isUniqueViolation) {
        throw error;
      }
      // retry with a fresh id/token
    }
  }

  throw new Error('Failed to create anonymous session');
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
