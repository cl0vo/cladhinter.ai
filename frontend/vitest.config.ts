import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: [
      { find: /^npm:(.+)$/, replacement: '$1' },
      { find: '@shared', replacement: path.resolve(__dirname, '../shared') },
      { find: '@shared/', replacement: path.resolve(__dirname, '../shared/') },
    ],
  },
});
