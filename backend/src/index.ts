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

    // 1. Check Database connection
    try {
      await connectDatabase();
    } catch (dbErr: any) {
      logger.warn(`⚠️ Database connection pending: ${dbErr.message}. Make sure PostgreSQL is running.`);
    }

    // 2. Check Redis connection
    const redisHealthy = await checkRedisHealth();
    if (redisHealthy) {
      logger.info(' Redis connection verified.');
    } else {
      logger.warn('⚠️ Redis not immediately responding. Queuing will wait for Redis reconnection.');
    }

    // 3. Initialize BullMQ Email Worker
    const worker = createEmailWorker();

    // 4. Initialize Elasticsearch
    await initElasticsearch();

    // 5. Start Express App
    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info(` ReachInbox API running on http://localhost:${env.PORT}`);
      logger.info(`🔍 Environment: ${env.NODE_ENV}`);
      logger.info(`🌐 Frontend Origin: ${env.CLIENT_URL}`);
      logger.info(` Bull-Board Dashboard: http://localhost:${env.PORT}/admin/queues`);
      logger.info(`🩺 Health check: http://localhost:${env.PORT}/health`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.warn(`Received ${signal}. Gracefully terminating services...`);

      try {
        await worker.close();
        logger.info('BullMQ Worker stopped gracefully.');
      } catch (e: any) {
        logger.error('Error closing worker:', e.message);
      }

      try {
        await redisClient.quit();
        logger.info('Redis client disconnected.');
      } catch (e: any) {
        logger.error('Error closing redis:', e.message);
      }

      try {
        await disconnectDatabase();
      } catch (e: any) {
        logger.error('Error disconnecting database:', e.message);
      }

      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forceful shutdown timeout reached.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Fatal error during server startup:', error);
    process.exit(1);
  }
};

startServer();
