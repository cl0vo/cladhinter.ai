import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: [{ find: /^npm:(.+)$/, replacement: '$1' }],
  },
});
