import { useState, useEffect } from 'react';
import { useTonConnect } from './useTonConnect';

export interface AuthUser {
  id: string;
  address: string;
  rawAddress: string;
  chain: string;
  publicKey: string;
  accessToken: string;
}

function createAuthUserId(address: string) {
  const sanitized = address.replace(/[^a-zA-Z0-9_-]/g, '');
  return `ton_${sanitized}`;
}

export function useAuth() {
  const { wallet, status } = useTonConnect();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'verifying' || status === 'connecting') {
      setLoading(true);
      return;
    }

    if (wallet) {
      const authId = wallet.userId || createAuthUserId(wallet.rawAddress || wallet.address);
      const accessToken = wallet.accessToken;

      setUser((prevUser) => {
        if (
          prevUser &&
          prevUser.id === authId &&
          prevUser.address === wallet.address &&
          prevUser.rawAddress === wallet.rawAddress &&
          prevUser.chain === wallet.chain &&
          prevUser.publicKey === wallet.publicKey &&
          prevUser.accessToken === accessToken
        ) {
          return prevUser;
        }

        return {
          id: authId,
          address: wallet.address,
          rawAddress: wallet.rawAddress,
          chain: wallet.chain,
          publicKey: wallet.publicKey,
          accessToken,
        };
      });
    } else {
      setUser((prevUser) => (prevUser ? null : prevUser));
    }

    setLoading(false);
  }, [wallet, status]);

  return { user, loading };
}
