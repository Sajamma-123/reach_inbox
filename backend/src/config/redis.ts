import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export let isRedisConnected = false;

export const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 5) {
      // Don't spam terminal if redis is offline
      return null;
    }
    const delay = Math.min(times * 300, 2000);
    return delay;
  },
};

export const redisClient = new Redis(redisOptions);

redisClient.on('connect', () => {
  logger.info(`🔌 Connecting to Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redisClient.on('ready', () => {
  isRedisConnected = true;
  logger.info(' Connected & Ready with Redis');
});

redisClient.on('error', (err) => {
  isRedisConnected = false;
  // Keep logs clean when Redis isn't running locally
  if (err.message.includes('ECONNREFUSED')) {
    // Suppress continuous ECONNREFUSED log flood
  } else {
    logger.warn('Redis notice:', err.message);
  }
});

export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const pingPromise = redisClient.ping();
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Redis ping timed out')), 1500)
    );
    const pong = await Promise.race([pingPromise, timeoutPromise]);
    isRedisConnected = pong === 'PONG';
    return isRedisConnected;
  } catch {
    isRedisConnected = false;
    return false;
  }
};
