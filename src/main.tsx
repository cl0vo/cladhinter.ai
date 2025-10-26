import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TonConnectUIProvider, CHAIN } from '@tonconnect/ui-react';

import App from '../App';
import '../styles/globals.css';

const manifestUrl =
  import.meta.env.VITE_TON_MANIFEST ||
  import.meta.env.VITE_TON_MANIFEST_URL ||
  'https://cladhunter.app/tonconnect-manifest.json';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl} defaultNetwork={CHAIN.MAINNET}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <App />
      </ThemeProvider>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
