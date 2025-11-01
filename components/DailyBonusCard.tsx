import { Gift, Flame, Clock } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { GlassCard } from './GlassCard';
import { Button } from './ui/button';
import type { DailyBonusStatusResponse } from '../types';

interface DailyBonusCardProps {
  status: DailyBonusStatusResponse | null;
  loading: boolean;
  claiming: boolean;
  onClaim: () => Promise<void>;
}

const pluralize = (value: number, noun: string) =>
  `${value} ${noun}${value === 1 ? '' : 's'}`;

export function DailyBonusCard({
  status,
  loading,
  claiming,
  onClaim,
}: DailyBonusCardProps) {
  const claimableReward = status?.claimable ? status.claimable_reward : 0;
  const nextReward = status?.next_reward ?? 0;
  const streak = status?.streak ?? 0;

  const nextAvailableAt = status?.next_available_at
    ? new Date(status.next_available_at)
    : null;

  const showCountdown =
    status && !status.claimable && nextAvailableAt && nextAvailableAt > new Date();

  const countdownLabel = showCountdown
    ? formatDistanceToNowStrict(nextAvailableAt, { addSuffix: true }).toUpperCase()
    : null;

  const buttonDisabled = loading || claiming || !status?.claimable;

  return (
    <GlassCard className="p-4 mb-5 overflow-hidden relative">
      <div className="absolute inset-0 bg-[#FF0033]/5 blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
              Daily Bonus
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl text-[#FF0033] font-semibold tracking-wide">
                {status?.claimable ? `+${claimableReward}` : `+${nextReward}`}
              </span>
              <span className="text-white/50 text-xs uppercase tracking-wider">
                ⚡ Energy
              </span>
            </div>
            <p className="text-white/40 text-[11px] uppercase mt-2">
              Streak: {pluralize(streak, 'day')}
            </p>
          </div>
          <div className="flex flex-col items-end text-[#FF0033]">
            <Gift size={20} />
            <Flame size={16} className="opacity-80 mt-1" />
          </div>
        </div>

        {loading ? (
          <div className="h-9 rounded bg-white/5 animate-pulse" />
        ) : (
          <Button
            onClick={onClaim}
            disabled={buttonDisabled}
            className="w-full bg-[#FF0033] hover:bg-[#FF0033]/80 text-white uppercase tracking-wider min-h-[44px]"
          >
            {status?.claimable
              ? claiming
                ? 'Claiming...'
                : 'Claim Bonus'
              : 'Claimed Today'}
          </Button>
        )}

        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-white/40">
          <div className="flex items-center gap-1">
            <Clock size={10} />
            <span>
              {status?.claimable
                ? 'Available now'
                : countdownLabel || 'Next reset pending'}
            </span>
          </div>
          <span>Next: +{nextReward} ⚡</span>
        </div>
      </div>
    </GlassCard>
  );
}
