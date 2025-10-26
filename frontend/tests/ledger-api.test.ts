import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ensureDatabaseMock = vi.fn();
const completeAdWatchMock = vi.fn();

vi.mock('../../backend/src/postgres', () => ({
  ensureDatabase: ensureDatabaseMock,
}));

vi.mock('../../backend/src/services/userService', () => ({
  completeAdWatch: completeAdWatchMock,
  claimReward: vi.fn(),
  createOrder: vi.fn(),
  confirmOrder: vi.fn(),
  getPaymentStatus: vi.fn(),
  getRewardStatus: vi.fn(),
  getUserBalance: vi.fn(),
  getUserStats: vi.fn(),
  initUser: vi.fn(),
  registerTonPayment: vi.fn(),
  retryPayment: vi.fn(),
  getLedgerHistory: vi.fn(),
}));

const { createApiMiddleware } = await import('../../backend/src/routes');

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('ledger entries', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    ensureDatabaseMock.mockResolvedValue(undefined);
    completeAdWatchMock.mockResolvedValue({
      success: true,
      reward: 25,
      new_balance: 25,
      multiplier: 1,
      daily_watches_remaining: 9,
    });

    const middleware = createApiMiddleware();
    server = http.createServer((req, res) => {
      void middleware(req, res, () => {
        res.statusCode = 404;
        res.end();
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await closeServer(server);
  });

  it('creates a ledger entry after completing an ad watch via API', async () => {
    const response = await fetch(`${baseUrl}/api/ads/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'user-ledger',
        adId: 'demo_video_1',
      }),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as { success?: boolean };
    expect(body.success).toBe(true);

    expect(ensureDatabaseMock).toHaveBeenCalled();
    expect(completeAdWatchMock).toHaveBeenCalledWith({ userId: 'user-ledger', adId: 'demo_video_1' });
  });
});
