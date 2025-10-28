import 'dotenv/config';

import http from 'node:http';

import { getHttpConfig } from './config';
import { createApiMiddleware } from './routes';

const { port, host } = getHttpConfig();

const apiMiddleware = createApiMiddleware();

const server = http.createServer((req, res) => {
  apiMiddleware(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  });
});

server.listen(port, host, () => {
  console.info(`[api] Server listening on http://${host}:${port}`);
});

function handleShutdown(signal: string) {
  console.info(`[api] Received ${signal}, closing server...`);
  server.close(() => {
    console.info('[api] Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
