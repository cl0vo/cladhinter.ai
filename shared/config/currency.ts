import { energyToTon, tonToEnergy } from './economy';

export type CurrencyCode = 'CL' | 'TON';

export interface CurrencyDefinition {
  code: CurrencyCode;
  label: string;
  symbol: string;
  emoji: string;
  decimals: number;
}

export const PRIMARY_CURRENCY: CurrencyCode = 'CL';
export const SECONDARY_CURRENCY: CurrencyCode = 'TON';

export const CURRENCIES: Record<CurrencyCode, CurrencyDefinition> = {
  CL: {
    code: 'CL',
    label: 'CladHunter CL',
    symbol: 'CL',
    emoji: '🆑',
    decimals: 1,
  },
  TON: {
    code: 'TON',
    label: 'Toncoin',
    symbol: 'TON',
    emoji: '💎',
    decimals: 6,
  },
};

export type CurrencyBalances = Record<CurrencyCode, number>;

export function getCurrencyMeta(code: CurrencyCode): CurrencyDefinition {
  return CURRENCIES[code];
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  options?: Intl.NumberFormatOptions,
): string {
  const baseDecimals =
    currency === 'CL'
      ? amount < 1
        ? 2
        : amount < 100
        ? 1
        : 0
      : CURRENCIES[currency].decimals;

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: baseDecimals,
    maximumFractionDigits: baseDecimals,
    ...options,
  });

  return formatter.format(amount);
}

export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) {
    return amount;
  }

  if (from === 'CL' && to === 'TON') {
    return energyToTon(amount);
  }

  if (from === 'TON' && to === 'CL') {
    return tonToEnergy(amount);
  }

  throw new Error(`Unsupported currency conversion: ${from} -> ${to}`);
}

export function buildBalanceBreakdown(clAmount: number): CurrencyBalances {
  return {
    CL: clAmount,
    TON: convertCurrency(clAmount, 'CL', 'TON'),
  };
}
