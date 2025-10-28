import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': `${rootDir}src`,
    },
  },
});
