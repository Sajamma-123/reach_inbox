import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis connection lost. Retrying in ${delay}ms... (attempt ${times})`);
    return delay;
  },
};

export const redisClient = new Redis(redisOptions);

redisClient.on('connect', () => {
  logger.info(`🔌 Connecting to Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redisClient.on('ready', () => {
  logger.info(' Connected & Ready with Redis');
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis Client Error:', err.message);
});

export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (error) {
    return false;
  }
};
