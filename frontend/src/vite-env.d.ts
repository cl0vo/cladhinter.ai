/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TON_MANIFEST?: string;
  readonly VITE_TON_MANIFEST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
