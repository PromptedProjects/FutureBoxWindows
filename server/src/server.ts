import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Config } from './config.js';
import type { Logger } from './utils/logger.js';

export async function buildServer(config: Config, logger: Logger) {
  const app = Fastify({ loggerInstance: logger });

  await app.register(cors, { origin: true });

  // Health / status route (hardcoded for Phase 1, real stats added in Phase 7)
  app.get('/status', async () => ({
    ok: true,
    data: {
      version: '0.1.0',
      uptime: process.uptime(),
      status: 'running',
    },
  }));

  return app;
}
