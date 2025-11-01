import React from 'react';
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import * as Sentry from '@sentry/react';

import App from '../App';
import '../styles/globals.css';

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();

if (sentryDsn) {
  const tracesSampleRate = Number.parseFloat(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0',
  );

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      new Sentry.BrowserTracing({
        tracePropagationTargets: [
          /^https?:\/\/localhost/i,
          /^https:\/\/cladhunter-api\.onrender\.com/i,
          /^\//,
        ],
      }),
    ],
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
    enabled: true,
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>,
);
