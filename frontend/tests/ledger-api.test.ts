import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const connectToDatabaseMock = vi.fn();
const userFindByIdMock = vi.fn();
const watchLogCreateMock = vi.fn();
const ledgerCreateMock = vi.fn();

vi.mock('../../backend/src/mongo', () => ({
  connectToDatabase: connectToDatabaseMock,
}));

vi.mock('../../backend/src/models/User', () => ({
  UserModel: {
    findById: userFindByIdMock,
  },
}));

vi.mock('../../backend/src/models/WatchLog', () => ({
  WatchLogModel: {
    create: watchLogCreateMock,
  },
}));

vi.mock('../../backend/src/models/Ledger', () => ({
  LedgerModel: {
    create: ledgerCreateMock,
  },
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
    connectToDatabaseMock.mockResolvedValue(undefined);

    const userDoc = {
      _id: 'user-ledger',
      wallet: 'EQuserledgerwallet',
      walletAddress: 'EQuserledgerwallet',
      energy: 0,
      totalEarned: 0,
      totalWatches: 0,
      dailyWatchCount: 0,
      dailyWatchDate: null as string | null,
      countryCode: null as string | null,
      lastWatchAt: null as Date | null,
      lastSeenAt: new Date(),
      sessionCount: 0,
      claimedPartners: [] as string[],
      save: vi.fn(async () => undefined),
    };

    userFindByIdMock.mockResolvedValue(userDoc);

    watchLogCreateMock.mockResolvedValue({
      _id: 'watch-log-id',
    });

    ledgerCreateMock.mockResolvedValue({
      _id: 'ledger-entry-id',
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

    expect(connectToDatabaseMock).toHaveBeenCalled();
    expect(ledgerCreateMock).toHaveBeenCalledTimes(1);
    expect(ledgerCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-ledger',
        wallet: 'EQuserledgerwallet',
        amount: 25,
        type: 'credit',
      }),
    );
    expect(ledgerCreateMock.mock.calls[0]?.[0]?.metadata).toMatchObject({ adId: 'demo_video_1' });
  });
});
