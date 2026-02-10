import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { Config } from './config.js';
import type { Logger } from './utils/logger.js';
import { pairRoutes } from './routes/pair.js';
import { modelRoutes } from './routes/models.js';
import { chatRoutes } from './routes/chat.js';
import { historyRoutes } from './routes/history.js';
import { wsRoutes } from './routes/ws.js';
import { requireAuth } from './middleware/auth.middleware.js';

export async function buildServer(config: Config, logger: Logger) {
  const app = Fastify({ loggerInstance: logger });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // --- Public routes (no auth) ---

  // Health / status route (hardcoded for Phase 1, real stats added in Phase 7)
  app.get('/status', async () => ({
    ok: true,
    data: {
      version: '0.1.0',
      uptime: process.uptime(),
      status: 'running',
    },
  }));

  // Pairing routes
  await app.register(pairRoutes);

  // WebSocket (auth handled inside via query param)
  await app.register(wsRoutes);

  // --- Protected routes (require auth) ---
  app.register(async (protectedScope) => {
    protectedScope.addHook('preHandler', requireAuth);

    // Authenticated health check (verifies token works)
    protectedScope.get('/me', async (request) => ({
      ok: true,
      data: { session_id: request.sessionId },
    }));

    // Model routes
    await protectedScope.register(modelRoutes);

    // Chat routes
    await protectedScope.register(chatRoutes);

    // History routes
    await protectedScope.register(historyRoutes);
  });

  return app;
}
