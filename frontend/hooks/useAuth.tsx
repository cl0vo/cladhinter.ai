import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiRequest } from '../utils/api/client';

export interface AuthUser {
  id: string;
  accessToken: string;
  walletAddress: string;
}

interface StoredWalletSession {
  userId: string;
  accessToken: string;
  walletAddress: string;
  updatedAt: string;
}

interface SessionResponse {
  userId: string;
  accessToken: string;
  walletAddress: string;
}

interface ChallengeResponse {
  payload: string;
}

const STORAGE_KEY = 'cladhunter_wallet_sessions_v1';
const CHALLENGE_REFRESH_MS = 10 * 60 * 1000;

type TonProofSuccess = {
  proof: {
    timestamp: number;
    domain: { value: string; lengthBytes: number };
    signature: string;
    payload: string;
    state_init?: string | null;
  };
};

function readStoredSessions(): Record<string, StoredWalletSession> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, StoredWalletSession>;
    return parsed ?? {};
  } catch (error) {
    console.warn('[auth] Failed to parse stored wallet sessions.', error);
    return {};
  }
}

function persistSession(session: StoredWalletSession): void {
  if (typeof window === 'undefined') {
    return;
  }
  const sessions = readStoredSessions();
  sessions[session.walletAddress] = session;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.warn('[auth] Unable to persist wallet session.', error);
  }
}

function removeSession(walletAddress: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const sessions = readStoredSessions();
  let modified = false;

  if (walletAddress in sessions) {
    delete sessions[walletAddress];
    modified = true;
  }

  for (const key of Object.keys(sessions)) {
    if (sessions[key]?.walletAddress === walletAddress) {
      delete sessions[key];
      modified = true;
    }
  }

  if (modified) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.warn('[auth] Unable to remove wallet session.', error);
    }
  }
}

function normaliseWalletAddress(address: string): string {
  return address.trim();
}

function findStoredSession(address: string | null | undefined): StoredWalletSession | null {
  if (!address) {
    return null;
  }
  const sessions = readStoredSessions();
  const key = normaliseWalletAddress(address);
  if (sessions[key]) {
    return sessions[key];
  }
  const match = Object.values(sessions).find(
    (session) => normaliseWalletAddress(session.walletAddress) === key,
  );
  return match ?? null;
}

export function useAuth() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentChallengeRef = useRef<string | null>(null);
  const abortAuthRef = useRef<AbortController | null>(null);

  const walletAddress = useMemo(() => {
    const address = wallet?.account.address;
    return address ? normaliseWalletAddress(address) : null;
  }, [wallet]);

  const applySession = useCallback((session: SessionResponse) => {
    const payload: StoredWalletSession = {
      userId: session.userId,
      accessToken: session.accessToken,
      walletAddress: session.walletAddress,
      updatedAt: new Date().toISOString(),
    };
    persistSession(payload);
    setUser({
      id: session.userId,
      accessToken: session.accessToken,
      walletAddress: session.walletAddress,
    });
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  const fetchChallenge = useCallback(async () => {
    tonConnectUI.setConnectRequestParameters({ state: 'loading' });
    try {
      const response = await apiRequest<ChallengeResponse>('/auth/ton-connect/challenge', {
        method: 'GET',
      });
      if (response?.payload) {
        currentChallengeRef.current = response.payload;
        tonConnectUI.setConnectRequestParameters({
          state: 'ready',
          value: {
            items: [
              {
                name: 'ton-proof',
                payload: response.payload,
              },
            ],
          },
        });
      } else {
        currentChallengeRef.current = null;
        tonConnectUI.setConnectRequestParameters(null);
      }
    } catch (err) {
      console.error('[auth] Failed to fetch ton-proof challenge', err);
      currentChallengeRef.current = null;
      tonConnectUI.setConnectRequestParameters(null);
    }
  }, [tonConnectUI]);

  const authenticateWithProof = useCallback(
    async (proof: TonProofSuccess) => {
      if (!wallet || !wallet.account) {
        throw new Error('Wallet not available for authentication');
      }

      const controller = new AbortController();
      abortAuthRef.current = controller;

      try {
        const response = await apiRequest<SessionResponse>('/auth/ton-connect', {
          method: 'POST',
          body: JSON.stringify({
            address: wallet.account.address,
            network: wallet.account.chain,
            public_key: wallet.account.publicKey,
            state_init: wallet.account.walletStateInit,
            proof: proof.proof,
          }),
          signal: controller.signal,
        });
        applySession(response);
        setError(null);
      } catch (err) {
        console.error('[auth] Wallet authentication failed', err);
        setError('Failed to authenticate wallet');
        clearSession();
        throw err;
      } finally {
        abortAuthRef.current = null;
      }
    },
    [applySession, clearSession, wallet],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    fetchChallenge();
    const interval = window.setInterval(fetchChallenge, CHALLENGE_REFRESH_MS);
    return () => {
      window.clearInterval(interval);
      tonConnectUI.setConnectRequestParameters(null);
    };
  }, [fetchChallenge, tonConnectUI]);

  useEffect(() => {
    if (!walletAddress) {
      clearSession();
      setLoading(false);
      return;
    }

    const existing = findStoredSession(walletAddress);
    if (existing) {
      setUser({
        id: existing.userId,
        accessToken: existing.accessToken,
        walletAddress: existing.walletAddress,
      });
      setLoading(false);
      return;
    }

    const tonProof = wallet?.connectItems?.tonProof;
    if (!tonProof || !('proof' in tonProof)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    authenticateWithProof(tonProof as TonProofSuccess)
      .catch(() => {
        if (!cancelled) {
          fetchChallenge().catch(() => {});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      abortAuthRef.current?.abort();
    };
  }, [authenticateWithProof, clearSession, fetchChallenge, wallet, walletAddress]);

  const refreshSession = useCallback(async () => {
    if (
      !wallet ||
      !wallet.connectItems?.tonProof ||
      !('proof' in wallet.connectItems.tonProof)
    ) {
      await fetchChallenge();
      return;
    }
    if (walletAddress) {
      removeSession(walletAddress);
    }
    setLoading(true);
    try {
      await authenticateWithProof(wallet.connectItems.tonProof as TonProofSuccess);
    } finally {
      setLoading(false);
    }
  }, [authenticateWithProof, fetchChallenge, wallet, walletAddress]);

  return {
    user,
    loading,
    error,
    refreshSession,
    walletAddress,
  };
}
