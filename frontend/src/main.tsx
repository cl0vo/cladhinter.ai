import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

import App from '../App';
import '../styles/globals.css';

const resolveFallbackManifestUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/tonconnect-manifest.json`;
  }

  return '/tonconnect-manifest.json';
};

const manifestUrl =
  import.meta.env.VITE_TON_MANIFEST ||
  import.meta.env.VITE_TON_MANIFEST_URL ||
  resolveFallbackManifestUrl();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <App />
      </ThemeProvider>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
