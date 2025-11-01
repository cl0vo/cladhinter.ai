import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ExternalLink, Gift } from 'lucide-react';
import { toast } from 'sonner';

import { getActivePartners, platformConfig, type PartnerReward } from '@shared/config/partners';

import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import type { ClaimRewardResponse, RewardStatusResponse } from '../types';
import { hapticFeedback } from '../utils/telegram';
import { GlassCard } from './GlassCard';
import { formatCl } from '../utils/helpers';
import { captureEvent } from '../utils/analytics';

interface RewardsSectionProps {
  onRewardClaimed?: () => void;
}

export function RewardsSection({ onRewardClaimed }: RewardsSectionProps) {
  const { makeRequest } = useApi();
  const { user } = useAuth();
  const [claimedPartners, setClaimedPartners] = useState<string[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const partners = getActivePartners();

  const loadRewardStatus = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const response = await makeRequest<RewardStatusResponse>(
        '/rewards/status',
        { method: 'GET' },
        user.accessToken,
        user.id,
      );
      if (response) {
        setClaimedPartners(response.claimed_partners);
      }
    } catch (error) {
      console.error('[rewards] Failed to load status', error);
    } finally {
      setLoading(false);
    }
  }, [makeRequest, user]);

  useEffect(() => {
    void loadRewardStatus();
  }, [loadRewardStatus]);

  const handleClaimReward = async (partner: PartnerReward) => {
    if (!user || claiming || claimedPartners.includes(partner.id)) {
      return;
    }

    window.open(partner.url, '_blank', 'noopener,noreferrer');
    hapticFeedback('impact', 'medium');

    setClaiming(partner.id);

    try {
      const response = await makeRequest<ClaimRewardResponse>(
        '/rewards/claim',
        {
          method: 'POST',
          body: JSON.stringify({
            partner_id: partner.id,
            partner_name: partner.name,
            reward_amount: partner.reward,
          }),
        },
        user.accessToken,
        user.id,
      );

      if (response) {
        setClaimedPartners((previous) => [...previous, partner.id]);
        toast.success(`+${formatCl(response.reward)} CL earned`, {
          description: `Thanks for supporting ${response.partner_name}.`,
        });
        captureEvent('reward_claimed', {
          partner_id: partner.id,
          partner_name: partner.name,
          reward: response.reward,
        });
        hapticFeedback('notification', 'success');
        onRewardClaimed?.();
      } else {
        toast.error('Failed to claim reward. Please try again.');
        hapticFeedback('notification', 'error');
      }
    } catch (error) {
      console.error('[rewards] Claim failed', error);
      toast.error('Failed to claim reward. Please try again.');
      hapticFeedback('notification', 'error');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full">
        <p className="mb-3 text-xs uppercase tracking-wider text-white/40">Rewards</p>
        <GlassCard className="px-4 py-8">
          <p className="text-center text-xs uppercase text-white/40">Loading...</p>
        </GlassCard>
      </div>
    );
  }

  if (partners.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <Gift size={14} className="text-[#FF0033]" />
        <p className="text-xs uppercase tracking-wider text-white/40">Partner rewards</p>
      </div>

      <div className="flex flex-col gap-2">
        {partners.map((partner) => {
          const isClaimed = claimedPartners.includes(partner.id);
          const isClaiming = claiming === partner.id;
          const platform = platformConfig[partner.platform];

          return (
            <GlassCard key={partner.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    {partner.icon ? <span className="text-sm">{partner.icon}</span> : null}
                    <p className="truncate text-sm uppercase tracking-wide text-white">
                      {partner.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase text-white/50">
                      {platform.icon} {platform.name}
                    </p>
                    {!isClaimed && (
                      <>
                        <span className="text-white/30">|</span>
                        <p className="text-[10px] uppercase text-[#FF0033]">
                          +{formatCl(partner.reward)} CL
                        </p>
                      </>
                    )}
                  </div>
                  {partner.description ? (
                    <p className="mt-1 line-clamp-1 text-[9px] text-white/40">{partner.description}</p>
                  ) : null}
                </div>

                <motion.button
                  type="button"
                  onClick={() => handleClaimReward(partner)}
                  disabled={isClaimed || isClaiming}
                  className={[
                    'flex-shrink-0 rounded px-3 py-1.5 text-[10px] uppercase tracking-wide touch-manipulation transition-colors',
                    isClaimed
                      ? 'bg-white/10 text-white/40'
                      : 'bg-[#FF0033]/10 text-[#FF0033] active:bg-[#FF0033]/20',
                    'disabled:opacity-50',
                  ].join(' ')}
                  whileTap={{ scale: isClaimed ? 1 : 0.95 }}
                >
                  {isClaimed ? (
                    <span className="flex items-center gap-1">
                      <Check size={12} />
                      Claimed
                    </span>
                  ) : isClaiming ? (
                    'Claiming...'
                  ) : (
                    <span className="flex items-center gap-1">
                      <ExternalLink size={10} />
                      Claim
                    </span>
                  )}
                </motion.button>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <p className="mt-2 text-center text-[9px] uppercase tracking-wide text-white/30">
        Subscribe to partners to unlock bonuses
      </p>
    </div>
  );
}
