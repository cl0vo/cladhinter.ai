import { useTonConnectUI, useTonWallet, useTonAddress } from '@tonconnect/ui-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { finishWalletProof, startWalletProof } from '../utils/api/sqlClient';

export interface TonWalletProof {
  timestamp: number;
  domain: {
    lengthBytes: number;
    value: string;
  };
  payload: string;
  signature: string;
  state_init?: string;
}

export interface TonWallet {
  address: string;
  rawAddress: string;
  chain: string;
  publicKey: string;
  proof: TonWalletProof;
  accessToken?: string;
  userId?: string;
}

interface TonConnectContextValue {
  wallet: TonWallet | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (params: { to: string; amount: string; payload?: string }) => Promise<{ boc?: string } | null>;
  isConnected: boolean;
  isVerifying: boolean;
  proofError: string | null;
  hasWalletConnection: boolean;
  friendlyAddress: string;
  rawAddress: string;
}

const TonConnectContext = createContext<TonConnectContextValue | undefined>(undefined);

interface TonConnectProviderProps {
  children: ReactNode;
}

export function TonConnectProvider({ children }: TonConnectProviderProps) {
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const userFriendlyAddress = useTonAddress();
  const [wallet, setWallet] = useState<TonWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [currentNonce, setCurrentNonce] = useState<string | null>(null);
  const [processedSignature, setProcessedSignature] = useState<string | null>(null);

  const friendlyAddress = wallet?.address || userFriendlyAddress || '';
  const rawAddress = wallet?.rawAddress || tonWallet?.account.address || '';
  const hasWalletConnection = Boolean(tonWallet);

  const normalizeChain = useCallback((value: string | undefined | null): string => {
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
  }, []);

  const connect = useCallback(async () => {
    if (!tonConnectUI) {
      throw new Error('TON Connect UI is not available.');
    }

    setIsConnecting(true);
    setProofError(null);
    setWallet(null);
    setProcessedSignature(null);

    try {
      tonConnectUI.setConnectRequestParameters({ state: 'loading' });

      const { nonce } = await startWalletProof();
      if (!nonce) {
        throw new Error('Unable to request TON proof payload.');
      }

      setCurrentNonce(nonce);

      tonConnectUI.setConnectRequestParameters({
        state: 'ready',
        value: { tonProof: nonce },
      });

      await tonConnectUI.openModal();
    } catch (error) {
      tonConnectUI.setConnectRequestParameters(null);
      const message = error instanceof Error ? error.message : 'Failed to connect wallet.';
      setProofError(message);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [tonConnectUI]);

  const disconnect = useCallback(async () => {
    let caught: unknown;
    try {
      await tonConnectUI?.disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      caught = error;
    } finally {
      setWallet(null);
      setProofError(null);
      setCurrentNonce(null);
      setProcessedSignature(null);
      tonConnectUI?.setConnectRequestParameters(null);
    }

    if (caught) {
      throw caught;
    }
  }, [tonConnectUI]);

  useEffect(() => {
    if (!tonWallet) {
      setWallet(null);
      setIsVerifying(false);
      setProofError(null);
      setCurrentNonce(null);
      setProcessedSignature(null);
      tonConnectUI?.setConnectRequestParameters(null);
      return;
    }

    const tonProof = tonWallet.connectItems?.tonProof;

  if (!tonProof) {
    console.debug('[ton-connect] wallet connected without proof', {
      address: tonWallet.account.address,
      rawAddress: tonWallet.account.address,
      connectItems: tonWallet.connectItems,
    });
    setIsVerifying(false);
    setProofError(null);
    return;
  }

    if ('error' in tonProof) {
      const message = tonProof.error?.message || 'Wallet declined the proof request.';
      setProofError(message);
      setWallet(null);
      setIsVerifying(false);
      setProcessedSignature(null);
      setCurrentNonce(null);
      return;
    }

    const { proof } = tonProof;

    if (processedSignature === proof.signature) {
      return;
    }

    setProcessedSignature(proof.signature);
    setIsVerifying(true);
    setProofError(null);

    console.debug('[ton-connect] received ton proof', {
      address: tonWallet.account.address,
      chain: tonWallet.account.chain,
      payloadLength: proof.payload.length,
      hasStateInit: Boolean(proof.state_init),
    });

    const nonce = currentNonce ?? proof.payload;
    let cancelled = false;

    (async () => {
      try {
        const normalizedChain = normalizeChain(tonWallet.account.chain);

        const response = await finishWalletProof({
          address: userFriendlyAddress || tonWallet.account.address,
          rawAddress: tonWallet.account.address,
          chain: normalizedChain,
          publicKey: tonWallet.account.publicKey || '',
          nonce,
          proof,
        });

        if (cancelled) {
          return;
        }

        setWallet({
          address: userFriendlyAddress || tonWallet.account.address,
          rawAddress: tonWallet.account.address,
          chain: normalizedChain,
          publicKey: tonWallet.account.publicKey || '',
          proof,
          accessToken: response.accessToken,
          userId: response.userId,
        });
        setProofError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('[ton-connect] proof verification failed', error);
        const message =
          error instanceof Error ? error.message : 'Failed to verify wallet proof.';
        setProofError(message);
        setWallet(null);
      } finally {
        if (cancelled) {
          return;
        }

        setIsVerifying(false);
        setCurrentNonce(null);
        tonConnectUI?.setConnectRequestParameters(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    tonWallet,
    tonConnectUI,
    userFriendlyAddress,
    currentNonce,
    processedSignature,
    normalizeChain,
  ]);

  const sendTransaction = useCallback(
    async (
      params: { to: string; amount: string; payload?: string },
    ): Promise<{ boc?: string } | null> => {
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      if (!tonConnectUI) {
        throw new Error('TON Connect UI is not available.');
      }

      try {
        const message: {
          address: string;
          amount: string;
          payload?: string;
        } = {
          address: params.to,
          amount: params.amount,
        };

        if (params.payload) {
          message.payload = params.payload;
        }

        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 600,
          messages: [message],
        };

        const result = await tonConnectUI.sendTransaction(transaction);
        if (result && typeof result === 'object') {
          return result as { boc?: string };
        }

        return null;
      } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
      }
    },
    [tonConnectUI, wallet],
  );

  const value = useMemo<TonConnectContextValue>(
    () => ({
      wallet,
      isConnecting,
      connect,
      disconnect,
      sendTransaction,
      isConnected: !!wallet,
      isVerifying,
      proofError,
      hasWalletConnection,
      friendlyAddress,
      rawAddress,
    }),
    [
      wallet,
      isConnecting,
      connect,
      disconnect,
      sendTransaction,
      isVerifying,
      proofError,
      hasWalletConnection,
      friendlyAddress,
      rawAddress,
    ],
  );

  useEffect(() => {
    if (!tonConnectUI || !import.meta.env.DEV || typeof window === 'undefined') {
      return;
    }

    const eventNames = [
      'ton-connect-ui-connection-started',
      'ton-connect-ui-connection-completed',
      'ton-connect-ui-connection-error',
      'ton-connect-ui-transaction-sent-for-signature',
      'ton-connect-ui-transaction-signed',
      'ton-connect-ui-transaction-signing-failed',
    ] as const;

    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      // eslint-disable-next-line no-console
      console.info(`[ton-connect] ${event.type}`, event.detail);
    };

    eventNames.forEach((eventName) => {
      window.addEventListener(eventName, handler as EventListener);
    });

    return () => {
      eventNames.forEach((eventName) => {
        window.removeEventListener(eventName, handler as EventListener);
      });
    };
  }, [tonConnectUI]);

  return <TonConnectContext.Provider value={value}>{children}</TonConnectContext.Provider>;
}

export function useTonConnect(): TonConnectContextValue {
  const context = useContext(TonConnectContext);
  if (!context) {
    throw new Error('useTonConnect must be used within a TonConnectProvider');
  }
  return context;
}
