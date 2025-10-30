import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig(({ command }) => {
  const rawBase = process.env.VITE_PUBLIC_BASE_PATH?.trim();

  const base =
    command === 'build'
      ? (() => {
          if (!rawBase) {
            return './';
          }
          if (rawBase === './' || rawBase === '/' || rawBase === '') {
            return rawBase === '' ? './' : rawBase;
          }
          return rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
        })()
      : '/';

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
  };
});
