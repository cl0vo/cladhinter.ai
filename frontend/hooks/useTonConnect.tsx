import {
  useTonAddress,
  useTonConnectUI,
  useTonWallet,
} from '@tonconnect/ui-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  finishWalletProof,
  startWalletProof,
  type WalletProofStartRequest,
} from '../utils/api/sqlClient';
import { getTelegramUserId } from '../utils/telegram';

type TonConnectStatus = 'idle' | 'connecting' | 'verifying' | 'ready';

interface ConnectedWallet {
  address: string;
  rawAddress: string;
  chain: string;
  publicKey: string;
  userId: string;
  accessToken: string;
}

interface TonConnectContextValue {
  wallet: ConnectedWallet | null;
  status: TonConnectStatus;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (params: {
    to: string;
    amount: string;
    payload?: string;
  }) => Promise<{ boc?: string } | null>;
}

const TonConnectContext = createContext<TonConnectContextValue | undefined>(undefined);

interface TonConnectProviderProps {
  children: ReactNode;
}

const STORAGE_KEYS = {
  wallet: 'cladhunter:lastWallet',
  userId: 'cladhunter:lastUserId',
  token: 'cladhunter:lastToken',
};

function loadStoredSession(): {
  wallet: string | null;
  userId: string | null;
  accessToken: string | null;
} {
  if (typeof window === 'undefined') {
    return { wallet: null, userId: null, accessToken: null };
  }

  try {
    const wallet = window.localStorage.getItem(STORAGE_KEYS.wallet);
    const userId = window.localStorage.getItem(STORAGE_KEYS.userId);
    const accessToken = window.localStorage.getItem(STORAGE_KEYS.token);
    return {
      wallet: wallet && wallet.trim() ? wallet : null,
      userId: userId && userId.trim() ? userId : null,
      accessToken: accessToken && accessToken.trim() ? accessToken : null,
    };
  } catch {
    return { wallet: null, userId: null, accessToken: null };
  }
}

function persistSession(data: { wallet: string; userId: string; accessToken: string }): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEYS.wallet, data.wallet);
    window.localStorage.setItem(STORAGE_KEYS.userId, data.userId);
    window.localStorage.setItem(STORAGE_KEYS.token, data.accessToken);
  } catch {
    // ignore storage failures
  }
}

function clearStoredSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEYS.wallet);
    window.localStorage.removeItem(STORAGE_KEYS.userId);
    window.localStorage.removeItem(STORAGE_KEYS.token);
  } catch {
    // ignore storage failures
  }
}

function normalizeChain(value: string | undefined | null): string {
  if (!value) {
    return 'ton-mainnet';
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'ton-mainnet' || trimmed === 'mainnet' || trimmed === '-239') {
    return 'ton-mainnet';
  }
  if (trimmed === 'ton-testnet' || trimmed === 'testnet' || trimmed === '-3') {
    return 'ton-testnet';
  }

  return value;
}

function resolveCurrentDomain(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.location?.host ?? null;
}

export function TonConnectProvider({ children }: TonConnectProviderProps) {
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const userFriendlyAddress = useTonAddress();

  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [status, setStatus] = useState<TonConnectStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const nonceRef = useRef<string | null>(null);
  const processedSignatureRef = useRef<string | null>(null);

  const resetState = useCallback(() => {
    setWallet(null);
    setStatus('idle');
    setError(null);
    nonceRef.current = null;
    processedSignatureRef.current = null;
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      await tonConnectUI?.disconnect();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('TON Connect disconnect failed', err);
    } finally {
      tonConnectUI?.setConnectRequestParameters(null);
      clearStoredSession();
      resetState();
    }
  }, [tonConnectUI, resetState]);

  const finalizeProof = useCallback(
    async (
      proof: {
        timestamp: number;
        domain: { value: string; lengthBytes: number };
        payload: string;
        signature: string;
        state_init?: string;
      },
      account: NonNullable<ReturnType<typeof useTonWallet>>['account'],
    ) => {
      if (!tonConnectUI) {
        throw new Error('TON Connect UI is not available');
      }

      const telegramUserId = getTelegramUserId() ?? undefined;
      const nonce = nonceRef.current ?? proof.payload;
      const normalizedChain = normalizeChain(account.chain);

      const response = await finishWalletProof({
        address: userFriendlyAddress || account.address,
        rawAddress: account.address,
        chain: normalizedChain,
        publicKey: account.publicKey || '',
        nonce,
        userId: telegramUserId,
        proof,
      });

      const connected: ConnectedWallet = {
        address: userFriendlyAddress || account.address,
        rawAddress: account.address,
        chain: normalizedChain,
        publicKey: account.publicKey || '',
        userId: response.userId,
        accessToken: response.accessToken,
      };

      setWallet(connected);
      setStatus('ready');
      setError(null);
      persistSession({
        wallet: response.wallet,
        userId: response.userId,
        accessToken: response.accessToken,
      });
      tonConnectUI.setConnectRequestParameters(null);
    },
    [tonConnectUI, userFriendlyAddress],
  );

  const connect = useCallback(async () => {
    if (!tonConnectUI) {
      throw new Error('TON Connect UI is not available');
    }

    const stored = loadStoredSession();
    const telegramUserId = getTelegramUserId();
    const domain = resolveCurrentDomain();

    const payload: WalletProofStartRequest = {
      ...(telegramUserId ? { userId: telegramUserId } : {}),
      ...(stored.userId && !telegramUserId ? { userId: stored.userId } : {}),
      ...(stored.wallet ? { wallet: stored.wallet } : {}),
      ...(domain ? { domain } : {}),
    };

    try {
      setStatus('connecting');
      setError(null);
      const { nonce } = await startWalletProof(payload);
      if (!nonce) {
        throw new Error('Failed to request TON proof payload');
      }
      nonceRef.current = nonce;

      tonConnectUI.setConnectRequestParameters({
        state: 'ready',
        value: { tonProof: nonce },
      });
      await tonConnectUI.openModal();
    } catch (err) {
      tonConnectUI.setConnectRequestParameters(null);
      nonceRef.current = null;
      const message = err instanceof Error ? err.message : 'Failed to open TON Connect modal';
      setError(message);
      setStatus('idle');
      throw err;
    }
  }, [tonConnectUI]);

  useEffect(() => {
    if (!tonConnectUI) {
      return;
    }

    const unsubscribe = tonConnectUI.onStatusChange(
      async (nextWallet) => {
        if (!nextWallet) {
          resetState();
          clearStoredSession();
          return;
        }

        const tonProofReply = nextWallet.connectItems?.tonProof;
        if (!tonProofReply) {
          return;
        }

        if ('error' in tonProofReply) {
          processedSignatureRef.current = null;
          setError(tonProofReply.error?.message ?? 'Wallet declined the proof request');
          setStatus('idle');
          tonConnectUI.setConnectRequestParameters(null);
          return;
        }

        if (!('proof' in tonProofReply)) {
          processedSignatureRef.current = null;
          setError('Unexpected TON proof response');
          setStatus('idle');
          tonConnectUI.setConnectRequestParameters(null);
          return;
        }

        const { proof } = tonProofReply;
        if (!proof?.signature) {
          processedSignatureRef.current = null;
          setError('Invalid TON proof response');
          setStatus('idle');
          tonConnectUI.setConnectRequestParameters(null);
          return;
        }

        if (processedSignatureRef.current === proof.signature) {
          return;
        }
        processedSignatureRef.current = proof.signature;

        try {
          setStatus('verifying');
          await finalizeProof(proof, nextWallet.account);
        } catch (err) {
          processedSignatureRef.current = null;
          tonConnectUI.setConnectRequestParameters(null);
          const message = err instanceof Error ? err.message : 'Failed to verify TON proof';
          setError(message);
          setStatus('idle');
          setWallet(null);
        } finally {
          nonceRef.current = null;
        }
      },
      (err) => {
        processedSignatureRef.current = null;
        tonConnectUI.setConnectRequestParameters(null);
        const message = err instanceof Error ? err.message : 'Wallet connection failed';
        setError(message);
        setStatus('idle');
      },
    );

    return () => {
      unsubscribe();
    };
  }, [tonConnectUI, finalizeProof, resetState]);

  useEffect(() => {
    if (!tonWallet) {
      return;
    }

    const stored = loadStoredSession();
    if (stored.accessToken && stored.wallet && !wallet) {
      setWallet({
        address: userFriendlyAddress || tonWallet.account.address,
        rawAddress: tonWallet.account.address,
        chain: normalizeChain(tonWallet.account.chain),
        publicKey: tonWallet.account.publicKey || '',
        userId: stored.userId ?? tonWallet.account.address,
        accessToken: stored.accessToken,
      });
      setStatus('ready');
    }
  }, [tonWallet, userFriendlyAddress, wallet]);

  const sendTransaction = useCallback(
    async (params: { to: string; amount: string; payload?: string }) => {
      if (!tonConnectUI) {
        throw new Error('TON Connect UI is not available');
      }
      if (!wallet) {
        throw new Error('Wallet is not connected');
      }

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: params.to,
            amount: params.amount,
            payload: params.payload,
          },
        ],
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      return result ?? null;
    },
    [tonConnectUI, wallet],
  );

  const contextValue = useMemo<TonConnectContextValue>(
    () => ({
      wallet,
      status,
      error,
      connect,
      disconnect: handleDisconnect,
      sendTransaction,
    }),
    [wallet, status, error, connect, handleDisconnect, sendTransaction],
  );

  return (
    <TonConnectContext.Provider value={contextValue}>{children}</TonConnectContext.Provider>
  );
}

export function useTonConnect(): TonConnectContextValue {
  const context = useContext(TonConnectContext);
  if (!context) {
    throw new Error('useTonConnect must be used within a TonConnectProvider');
  }
  return context;
}
