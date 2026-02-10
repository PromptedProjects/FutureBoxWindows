import { loadConfig } from './config.js';
import { createLogger } from './utils/logger.js';
import { buildServer } from './server.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);

  logger.info('FutureBox server starting...');

  const app = await buildServer(config, logger);

  await app.listen({ host: config.HOST, port: config.PORT });
  logger.info(`FutureBox listening on ${config.HOST}:${config.PORT}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error starting FutureBox:', err);
  process.exit(1);
});
