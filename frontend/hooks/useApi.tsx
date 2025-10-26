import { useState, useCallback, useMemo } from 'react';
import {
  claimReward,
  type ClaimRewardInput,
  completeAdWatch,
  type CompleteAdInput,
  confirmOrder,
  type ConfirmOrderInput,
  createOrder,
  type CreateOrderInput,
  getLedgerHistory,
  type LedgerHistoryRequest,
  getPaymentStatus,
  type PaymentStatusInput,
  getRewardStatus,
  type RewardStatusInput,
  getUserBalance,
  type BalanceInput,
  getUserStats,
  type StatsInput,
  initUser,
  type InitUserInput,
  registerTonPayment,
  type RegisterTonPaymentInput,
  retryPayment,
  type RetryPaymentInput,
} from '../utils/api/sqlClient';
import { useAuth } from './useAuth';

export function useApi() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await action();
      setLoading(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('SQL API error:', message);
      setError(message);
      setLoading(false);
      return null;
    }
  }, []);

  const withAccessToken = useCallback(
    <T extends { accessToken: string }>(input: Omit<T, 'accessToken'>): T => {
      const accessToken = user?.accessToken;
      if (!accessToken) {
        throw new Error('Wallet authorization required');
      }

      return {
        ...input,
        accessToken,
      } as T;
    },
    [user?.accessToken],
  );

  const api = useMemo(
    () => ({
      initUser: (input: Omit<InitUserInput, 'accessToken'>) =>
        execute(() => initUser(withAccessToken<InitUserInput>(input))),
      getUserBalance: (input: Omit<BalanceInput, 'accessToken'>) =>
        execute(() => getUserBalance(withAccessToken<BalanceInput>(input))),
      completeAdWatch: (input: Omit<CompleteAdInput, 'accessToken'>) =>
        execute(() => completeAdWatch(withAccessToken<CompleteAdInput>(input))),
      createOrder: (input: Omit<CreateOrderInput, 'accessToken'>) =>
        execute(() => createOrder(withAccessToken<CreateOrderInput>(input))),
      confirmOrder: (input: Omit<ConfirmOrderInput, 'accessToken'>) =>
        execute(() => confirmOrder(withAccessToken<ConfirmOrderInput>(input))),
      registerTonPayment: (input: Omit<RegisterTonPaymentInput, 'accessToken'>) =>
        execute(() => registerTonPayment(withAccessToken<RegisterTonPaymentInput>(input))),
      getPaymentStatus: (input: Omit<PaymentStatusInput, 'accessToken'>) =>
        execute(() => getPaymentStatus(withAccessToken<PaymentStatusInput>(input))),
      retryPayment: (input: Omit<RetryPaymentInput, 'accessToken'>) =>
        execute(() => retryPayment(withAccessToken<RetryPaymentInput>(input))),
      getUserStats: (input: Omit<StatsInput, 'accessToken'>) =>
        execute(() => getUserStats(withAccessToken<StatsInput>(input))),
      getRewardStatus: (input: Omit<RewardStatusInput, 'accessToken'>) =>
        execute(() => getRewardStatus(withAccessToken<RewardStatusInput>(input))),
      claimReward: (input: Omit<ClaimRewardInput, 'accessToken'>) =>
        execute(() => claimReward(withAccessToken<ClaimRewardInput>(input))),
      getLedgerHistory: (input: Omit<LedgerHistoryRequest, 'accessToken'>) =>
        execute(() => getLedgerHistory(withAccessToken<LedgerHistoryRequest>(input))),
    }),
    [execute, withAccessToken],
  );

  return {
    ...api,
    loading,
    error,
  };
}
