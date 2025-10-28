import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

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
    } catch (error) {
      // fall through to try without base origin
    }
  }

  try {
    return new URL(trimmed).toString();
  } catch (error) {
    return fallback;
  }
};

const manifestUrl = resolveManifestUrl(
  import.meta.env.VITE_TON_MANIFEST || import.meta.env.VITE_TON_MANIFEST_URL,
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <TonConnectProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <App />
        </ThemeProvider>
      </TonConnectProvider>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
