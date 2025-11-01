import { useState, useCallback } from 'react';
import { API_BASE_URL, getAuthHeaders } from '../utils/supabase/client';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(async <T,>(
    endpoint: string,
    options: RequestInit = {},
    accessToken?: string,
    userId?: string
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const headers = getAuthHeaders(userId);

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      setLoading(false);
      return data as T;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`API Error (${endpoint}):`, errorMessage);
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  }, []);

  return { makeRequest, loading, error };
}