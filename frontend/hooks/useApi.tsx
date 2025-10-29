import { useCallback, useState } from 'react';

import { apiRequest, type ApiRequestOptions } from '../utils/api/client';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(
    async <T,>(
      endpoint: string,
      init: ApiRequestOptions = {},
      accessToken?: string | null,
      userId?: string | null,
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiRequest<T>(endpoint, {
          ...init,
          accessToken,
          userId,
        });
        setLoading(false);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error(`API Error (${endpoint}):`, message);
        setError(message);
        setLoading(false);
        return null;
      }
    },
    [],
  );

  return { makeRequest, loading, error };
}
