import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useApi } from './useApi';
import type {
  DailyBonusStatusResponse,
  DailyBonusClaimResponse,
} from '../types';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

export function useDailyBonus() {
  const { user } = useAuth();
  const { makeRequest } = useApi();
  const [status, setStatus] = useState<DailyBonusStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const response = await makeRequest<DailyBonusStatusResponse>(
      '/bonus/status',
      { method: 'GET' },
      user.accessToken,
      user.id
    );

    if (response) {
      setStatus(response);
    }
    setLoading(false);
  }, [user, makeRequest]);

  const claimBonus = useCallback(async () => {
    if (!user) return null;

    setClaiming(true);
    const response = await makeRequest<DailyBonusClaimResponse>(
      '/bonus/claim',
      { method: 'POST' },
      user.accessToken,
      user.id
    );
    setClaiming(false);

    if (response) {
      setStatus({
        claimed_today: true,
        claimable: false,
        claimable_reward: 0,
        next_reward: response.next_reward,
        next_available_at: response.next_available_at,
        streak: response.streak,
        last_claim_date: getTodayDateString(),
      });
    }

    return response;
  }, [user, makeRequest]);

  useEffect(() => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    fetchStatus();
  }, [user, fetchStatus]);

  return {
    status,
    loading,
    claiming,
    refreshStatus: fetchStatus,
    claimBonus,
  };
}
