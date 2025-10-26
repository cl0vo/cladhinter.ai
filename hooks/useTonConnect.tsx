import { useTonConnectUI, useTonWallet, useTonAddress } from '@tonconnect/ui-react';
import { useCallback, useEffect, useState } from 'react';

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

export function useTonConnect() {
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
      setWallet(null);
      setProcessedSignature(null);
      setCurrentNonce(null);
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

    const nonce = currentNonce ?? proof.payload;
    let cancelled = false;

    (async () => {
      try {
        const response = await finishWalletProof({
          address: userFriendlyAddress || tonWallet.account.address,
          rawAddress: tonWallet.account.address,
          chain: tonWallet.account.chain,
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
          chain: tonWallet.account.chain,
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
  ]);

  const sendTransaction = useCallback(
    async (params: {
      to: string;
      amount: string; // in nanoTON
      payload?: string;
    }) => {
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
          validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
          messages: [message],
        };

        const result = await tonConnectUI.sendTransaction(transaction);
        return result;
      } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
      }
    },
    [tonConnectUI, wallet]
  );

  return {
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
  };
}
