import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import '@sentry/tracing';
import { ZodError } from 'zod';

import {
  getCorsAllowedOrigins,
  getHttpConfig,
  getNodeEnv,
  getRateLimitConfig,
  getSentryConfig,
} from './config';
import { ensureDatabase } from './db';
import apiRoutes from './routes';

const app = express();

const nodeEnv = getNodeEnv();
const { dsn: sentryDsn, tracesSampleRate, profilesSampleRate } = getSentryConfig();
const sentryEnabled = Boolean(sentryDsn);

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn ?? undefined,
    environment: nodeEnv,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
    ],
    tracesSampleRate,
    profilesSampleRate,
  });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

app.disable('x-powered-by');
app.use(
  cors({
    origin: getCorsAllowedOrigins(),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

const rateLimitOptions = getRateLimitConfig();
app.use(
  rateLimit({
    ...rateLimitOptions,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
  }),
);

app.use('/api', apiRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (sentryEnabled) {
  app.use(Sentry.Handlers.errorHandler());
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.errors.map((issue) => issue.message).join(', ') });
    return;
  }

  const status = typeof err?.status === 'number' ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Unexpected server error';

  if (status >= 500) {
    console.error('[api] Unhandled error:', err);
  }

  res.status(status).json({ error: message });
};

app.use(errorHandler);

async function start() {
  await ensureDatabase();
  const { host, port } = getHttpConfig();
  app.listen(port, host, () => {
    console.info(`[api] Server ready on http://${host}:${port} (${nodeEnv})`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    console.error('[api] Failed to start server', error);
    process.exit(1);
  });
}

export default app;
