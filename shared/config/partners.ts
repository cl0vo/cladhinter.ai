/**
 * Partner Rewards Configuration for Cladhunter
 *
 * Add your partner channels/accounts here. Users earn coins for subscribing.
 * Partners can be Telegram channels, X (Twitter) accounts, or other social platforms.
 *
 * IMPORTANT: To add a new partner, simply add a new object to the array below.
 */

export type PartnerPlatform = 'telegram' | 'x' | 'youtube' | 'instagram' | 'discord';

export interface PartnerReward {
  id: string; // Unique identifier (use snake_case: telegram_crypto_news)
  platform: PartnerPlatform; // Social platform
  name: string; // Partner display name
  username: string; // @username or channel name
  url: string; // Direct link to channel/profile
  reward: number; // Coins reward (recommended: 500-1000)
  description?: string; // Optional short description
  icon?: string; // Optional emoji/icon string
  active: boolean; // Set to false to temporarily disable
}

/**
 * Partner Rewards List
 * ADD YOUR PARTNERS BELOW
 */
export const partnerRewards: PartnerReward[] = [
  {
    id: 'telegram_cladhunter_official',
    platform: 'telegram',
    name: 'Cladhunter Official',
    username: '@cladhunter',
    url: 'https://t.me/cladhunter',
    reward: 1000,
    description: 'Official Cladhunter news and updates',
    icon: 'TG',
    active: true,
  },
  {
    id: 'telegram_crypto_insights',
    platform: 'telegram',
    name: 'Crypto Insights',
    username: '@cryptoinsights',
    url: 'https://t.me/cryptoinsights',
    reward: 750,
    description: 'Daily crypto market analysis',
    icon: 'CI',
    active: true,
  },
  {
    id: 'x_cladhunter',
    platform: 'x',
    name: 'Cladhunter X',
    username: '@cladhunter',
    url: 'https://x.com/cladhunter',
    reward: 800,
    description: 'Follow us on X for updates',
    icon: 'X',
    active: true,
  },
  {
    id: 'youtube_crypto_tutorials',
    platform: 'youtube',
    name: 'Crypto Tutorials',
    username: '@cryptotutorials',
    url: 'https://youtube.com/@cryptotutorials',
    reward: 500,
    description: 'Learn crypto mining basics',
    icon: 'YT',
    active: true,
  },
];

/**
 * Get all active partner rewards
 */
export function getActivePartners(): PartnerReward[] {
  return partnerRewards.filter((partner) => partner.active);
}

/**
 * Get partner by ID
 */
export function getPartnerById(id: string): PartnerReward | undefined {
  return partnerRewards.find((partner) => partner.id === id);
}

/**
 * Get partners by platform
 */
export function getPartnersByPlatform(platform: PartnerPlatform): PartnerReward[] {
  return partnerRewards.filter((partner) => partner.active && partner.platform === platform);
}

/**
 * Platform display configuration
 */
export const platformConfig: Record<
  PartnerPlatform,
  { name: string; color: string; icon: string }
> = {
  telegram: {
    name: 'Telegram',
    color: '#0088cc',
    icon: 'TG',
  },
  x: {
    name: 'X (Twitter)',
    color: '#000000',
    icon: 'X',
  },
  youtube: {
    name: 'YouTube',
    color: '#ff0000',
    icon: 'YT',
  },
  instagram: {
    name: 'Instagram',
    color: '#e4405f',
    icon: 'IG',
  },
  discord: {
    name: 'Discord',
    color: '#5865f2',
    icon: 'DS',
  },
};

const partnersConfig = {
  partnerRewards,
  getActivePartners,
  getPartnerById,
  getPartnersByPlatform,
  platformConfig,
};

export default partnersConfig;
