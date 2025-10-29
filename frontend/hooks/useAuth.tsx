import { useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  accessToken: string;
}

const STORAGE_KEY = 'cladhunter_auth';

interface StoredAuth {
  id: string;
  accessToken: string;
  createdAt: string;
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createAnonymousAuth(): StoredAuth {
  return {
    id: generateId('anon'),
    accessToken: generateId('token'),
    createdAt: new Date().toISOString(),
  };
}

function readStoredAuth(): StoredAuth {
  if (typeof window === 'undefined') {
    return createAnonymousAuth();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const auth = createAnonymousAuth();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      return auth;
    }

    const parsed = JSON.parse(raw) as StoredAuth | null;
    if (!parsed?.id || !parsed?.accessToken) {
      const auth = createAnonymousAuth();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      return auth;
    }

    return parsed;
  } catch (error) {
    console.warn('[auth] Failed to read stored auth, resetting.', error);
    const auth = createAnonymousAuth();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } catch {
      // ignore storage write errors
    }
    return auth;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readStoredAuth();
    setUser({
      id: auth.id,
      accessToken: auth.accessToken,
    });
    setLoading(false);
  }, []);

  return { user, loading, isAnonymous: true };
}
