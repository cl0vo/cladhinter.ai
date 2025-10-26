import 'dotenv/config';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

import { connectToDatabase } from './utils/db';
import { createApiMiddleware } from './server/routes';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cladhunter-dev-api',
      async configureServer(server) {
        try {
          await connectToDatabase();
          console.info('[database] Connected to MongoDB');
        } catch (error) {
          console.error('[database] Failed to connect:', error);
        }

        server.middlewares.use(createApiMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createApiMiddleware());
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
