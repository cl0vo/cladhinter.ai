import type { CHAIN } from '@tonconnect/ui';
import type { TonConnectUIProviderProps } from '@tonconnect/ui-react';

declare module '@tonconnect/ui-react' {
  interface TonConnectUIProviderProps {
    defaultNetwork?: CHAIN;
  }
}
