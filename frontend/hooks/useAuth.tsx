import { useCallback, useEffect, useRef, useState } from 'react';

import { apiRequest } from '../utils/api/client';

export interface AuthUser {
  id: string;
  accessToken: string;
}

const STORAGE_KEY = 'cladhunter_session_v2';
const SESSION_VERSION = 2;

interface StoredSession {
  userId: string;
  accessToken: string;
  createdAt: string;
  version: number;
}

interface AnonymousSessionResponse {
  userId: string;
  accessToken: string;
}

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredSession | null;
    if (!parsed || parsed.version !== SESSION_VERSION) {
      return null;
    }
    if (typeof parsed.userId !== 'string' || typeof parsed.accessToken !== 'string') {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('[auth] Failed to parse stored session, ignoring.', error);
    return null;
  }
}

function persistSession(session: StoredSession): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('[auth] Unable to persist session.', error);
  }
}

async function requestAnonymousSession(): Promise<StoredSession> {
  const response = await apiRequest<AnonymousSessionResponse>('/auth/anonymous', {
    method: 'POST',
  });
  return {
    userId: response.userId,
    accessToken: response.accessToken,
    createdAt: new Date().toISOString(),
    version: SESSION_VERSION,
  };
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const applySession = useCallback((session: StoredSession) => {
    setUser({
      id: session.userId,
      accessToken: session.accessToken,
    });
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const session = await requestAnonymousSession();
      if (!isMountedRef.current) {
        return;
      }
      persistSession(session);
      applySession(session);
    } catch (error) {
      console.error('[auth] Failed to create anonymous session.', error);
      if (isMountedRef.current) {
        setUser(null);
      }
      throw error;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [applySession]);

  useEffect(() => {
    isMountedRef.current = true;
    const stored = readStoredSession();
    if (stored) {
      applySession(stored);
      setLoading(false);
      return () => {
        isMountedRef.current = false;
      };
    }

    refreshSession().catch(() => {
      // error already logged in refreshSession
    });

    return () => {
      isMountedRef.current = false;
    };
  }, [applySession, refreshSession]);

  return { user, loading, isAnonymous: true, refreshSession };
}
