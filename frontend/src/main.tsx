import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import type { ActionConfiguration, WalletsListConfiguration } from '@tonconnect/ui';

import App from '../App';
import '../styles/globals.css';
import { TonConnectProvider } from '../hooks/useTonConnect';

const FALLBACK_MANIFEST_PATH = '/tonconnect-manifest.json';

const resolveFallbackManifestUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${FALLBACK_MANIFEST_PATH}`;
  }

  return FALLBACK_MANIFEST_PATH;
};

const resolveManifestUrl = (rawValue?: string | null) => {
  const fallback = resolveFallbackManifestUrl();
  const trimmed = rawValue?.trim();

  if (!trimmed) {
    return fallback;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      return new URL(trimmed, window.location.origin).toString();
    } catch {
      // fall through to try without base origin
    }
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return fallback;
  }
};

const resolveTwaReturnUrl = (): string | undefined => {
  const envValue =
    (import.meta.env.VITE_TWA_RETURN_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_TELEGRAM_RETURN_URL as string | undefined)?.trim();
  if (envValue) {
    try {
      return new URL(envValue).toString();
    } catch {
      return envValue;
    }
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  const botAlias = (import.meta.env.VITE_TELEGRAM_BOT as string | undefined)?.trim();
  if (!botAlias) {
    return undefined;
  }

  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  const suffix = startParam ? `?startapp=${encodeURIComponent(startParam)}` : '';
  return `https://t.me/${botAlias}${suffix}`;
};

const manifestUrl = resolveManifestUrl(
  import.meta.env.VITE_TON_MANIFEST || import.meta.env.VITE_TON_MANIFEST_URL,
);

const walletsListConfiguration: WalletsListConfiguration = {
  includeWallets: [
    {
      appName: 'telegram-wallet',
      name: 'Wallet',
      imageUrl: 'https://wallet.tg/images/logo-288.png',
      aboutUrl: 'https://wallet.tg/',
      universalLink: 'https://t.me/wallet/start',
      bridgeUrl: 'https://bridge.tonapi.io/bridge',
      platforms: ['ios', 'android', 'macos', 'windows', 'linux'],
    },
  ],
};

const actionsConfiguration: ActionConfiguration | undefined = (() => {
  const twaReturnUrl = resolveTwaReturnUrl();
  if (!twaReturnUrl || !twaReturnUrl.includes('://')) {
    return undefined;
  }

  return { twaReturnUrl: twaReturnUrl as `${string}://${string}` };
})();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      walletsListConfiguration={walletsListConfiguration}
      actionsConfiguration={actionsConfiguration}
    >
      <TonConnectProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <App />
        </ThemeProvider>
      </TonConnectProvider>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
