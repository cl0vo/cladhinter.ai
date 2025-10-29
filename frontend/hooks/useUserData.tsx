import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './useAuth';
import { useApi } from './useApi';

export interface UserData {
  id: string;
  energy: number;
  boost_level: number;
  boost_expires_at: string | null;
}

interface UserDataContextValue {
  userData: UserData | null;
  loading: boolean;
  refreshBalance: () => Promise<void>;
}

const UserDataContext = createContext<UserDataContextValue | undefined>(undefined);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { makeRequest } = useApi();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setUserData(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    makeRequest<{ user: UserData }>(
      '/user/init',
      { method: 'POST' },
      user.accessToken,
      user.id,
    )
      .then((data) => {
        if (!cancelled && data?.user) {
          setUserData(data.user);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, makeRequest]);

  const refreshBalance = useCallback(async () => {
    if (!user) {
      return;
    }

    const data = await makeRequest<{
      energy: number;
      boost_level: number;
      multiplier: number;
      boost_expires_at: string | null;
    }>('/user/balance', { method: 'GET' }, user.accessToken, user.id);

    if (data) {
      setUserData((previous) => ({
        ...(previous ?? {
          id: user.id,
          energy: 0,
          boost_level: 0,
          boost_expires_at: null,
        }),
        energy: data.energy,
        boost_level: data.boost_level,
        boost_expires_at: data.boost_expires_at,
      }));
    }
  }, [user, makeRequest]);

  const value = useMemo<UserDataContextValue>(
    () => ({
      userData,
      loading,
      refreshBalance,
    }),
    [userData, loading, refreshBalance],
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData(): UserDataContextValue {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
}
