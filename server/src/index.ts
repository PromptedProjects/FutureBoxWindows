import { loadConfig } from './config.js';
import { createLogger } from './utils/logger.js';
import { buildServer, type ServerOptions } from './server.js';
import { initDatabase, closeDatabase } from './storage/database.js';
import { runMigrations } from './storage/migrations.js';
import { OllamaProvider } from './providers/ollama.provider.js';
import { ClaudeProvider } from './providers/claude.provider.js';
import { OpenAIProvider } from './providers/openai.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { registry } from './providers/provider-registry.js';
import { Capability } from './providers/provider.interface.js';
import { ensureSelfSignedCerts, loadTLSCerts } from './utils/tls.js';
import { expireStaleActions } from './services/action.service.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);

  logger.info('FutureBox server starting...');

  // Initialize storage
  const db = initDatabase(config.DATA_DIR, logger);
  runMigrations(db, logger);

  // Initialize providers
  const ollama = new OllamaProvider(config.OLLAMA_HOST);
  registry.registerProvider(ollama);

  // Default capability assignments (Ollama local models)
  if (await ollama.isAvailable()) {
    const models = await ollama.listModels();
    if (models.length > 0) {
      const defaultModel = models[0].id;
      registry.assign(Capability.Language, 'ollama', defaultModel);
      logger.info(`Ollama available — default language model: ${defaultModel}`);
    }
  } else {
    logger.warn('Ollama not reachable — local models unavailable');
  }

  // Cloud providers (register if API keys are set)
  if (config.ANTHROPIC_API_KEY) {
    const claude = new ClaudeProvider(config.ANTHROPIC_API_KEY);
    registry.registerProvider(claude);
    // Add as fallback for language if Ollama is primary, or primary if no Ollama
    registry.assign(Capability.Language, 'claude', 'claude-sonnet-4-5-20250929');
    registry.assign(Capability.Reasoning, 'claude', 'claude-opus-4-6');
    logger.info('Claude provider registered');
  }

  if (config.OPENAI_API_KEY) {
    const openai = new OpenAIProvider(config.OPENAI_API_KEY);
    registry.registerProvider(openai);
    registry.assign(Capability.Language, 'openai', 'gpt-4o');
    logger.info('OpenAI provider registered');
  }

  if (config.GOOGLE_AI_API_KEY) {
    const gemini = new GeminiProvider(config.GOOGLE_AI_API_KEY);
    registry.registerProvider(gemini);
    registry.assign(Capability.Language, 'gemini', 'gemini-2.0-flash');
    logger.info('Gemini provider registered');
  }

  // TLS setup
  let serverOpts: ServerOptions | undefined;
  if (config.TLS_CERT_PATH && config.TLS_KEY_PATH) {
    const certs = loadTLSCerts(config.TLS_KEY_PATH, config.TLS_CERT_PATH);
    serverOpts = { https: certs };
    logger.info('TLS enabled (custom certs)');
  } else {
    const certs = ensureSelfSignedCerts(config.DATA_DIR, logger);
    if (certs.key && certs.cert) {
      serverOpts = { https: certs };
    }
  }

  const app = await buildServer(config, logger, serverOpts);

  await app.listen({ host: config.HOST, port: config.PORT });
  const protocol = serverOpts?.https ? 'https' : 'http';
  logger.info(`FutureBox listening on ${protocol}://${config.HOST}:${config.PORT}`);

  // Periodic cleanup: expire stale actions every hour
  const cleanupInterval = setInterval(() => {
    const expired = expireStaleActions();
    if (expired > 0) logger.info(`Expired ${expired} stale actions`);
  }, 60 * 60 * 1000);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    clearInterval(cleanupInterval);
    await app.close();
    closeDatabase(logger);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error starting FutureBox:', err);
  process.exit(1);
});
