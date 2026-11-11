import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { checkRedisHealth, redisClient } from './config/redis.js';
import { createEmailWorker } from './modules/worker/email.worker.js';
import { initElasticsearch } from './config/elasticsearch.js';

const startServer = async () => {
  try {
    logger.info(' Initializing ReachInbox Email Job Scheduler Server...');

    // 1. Create and Start Express Server FIRST so HTTP endpoints & health check are instantly alive!
    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info(` ReachInbox API running on http://localhost:${env.PORT}`);
      logger.info(`🔍 Environment: ${env.NODE_ENV}`);
      logger.info(`🌐 Frontend Origin: ${env.CLIENT_URL}`);
      logger.info(` Bull-Board Dashboard: http://localhost:${env.PORT}/admin/queues`);
      logger.info(`🩺 Health check: http://localhost:${env.PORT}/health`);
    });

    // 2. Connect Database asynchronously (with 2s timeout fallback)
    connectDatabase().catch((e) => logger.warn(`DB check: ${e.message}`));

    // 3. Check Redis connection asynchronously
    checkRedisHealth().then((redisHealthy) => {
      if (redisHealthy) {
        logger.info(' Redis connection verified.');
        try {
          createEmailWorker();
          logger.info(' BullMQ Worker cluster active.');
        } catch (workerErr: any) {
          logger.warn(`Worker init notice: ${workerErr.message}`);
        }
      } else {
        logger.warn('⚠️ Redis not detected on localhost:6379. Queues will operate in local fallback mode.');
        logger.warn('   Run "docker compose up -d" to enable multi-node BullMQ distributed queue.');
      }
    });

    // 4. Initialize Elasticsearch asynchronously
    initElasticsearch().catch(() => {});

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.warn(`Received ${signal}. Gracefully terminating services...`);

      try {
        await redisClient.quit();
      } catch {}

      try {
        await disconnectDatabase();
      } catch {}

      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forceful shutdown timeout reached.');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Fatal error during server startup:', error);
    process.exit(1);
  }
};

startServer();
