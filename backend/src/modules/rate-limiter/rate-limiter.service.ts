import { redisClient } from '../../config/redis.js';
import { ATOMIC_RATE_LIMIT_LUA } from './lua-scripts.js';
import { logger } from '../../utils/logger.js';
import EventEmitter from 'events';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  resetInMs: number;
}

class RateLimiterService extends EventEmitter {
  /**
   * Atomically checks and increments hourly email sending quota for a given sender
   */
  async checkAndIncrement(senderId: string, hourlyLimit: number): Promise<RateLimitResult> {
    const now = Date.now();
    const currentHour = Math.floor(now / (1000 * 60 * 60)); // Current epoch hour
    const key = `ratelimit:sender:${senderId}:hour:${currentHour}`;
    const ttlSeconds = 3600;

    try {
      const result = (await redisClient.eval(
        ATOMIC_RATE_LIMIT_LUA,
        1,
        key,
        hourlyLimit.toString(),
        ttlSeconds.toString()
      )) as [number, number, number];

      const [allowedFlag, currentCount, ttlRemaining] = result;
      const allowed = allowedFlag === 1;

      // Calculate exact milliseconds until the current hour window resets
      const resetInMs = Math.max(ttlRemaining * 1000, 1000);

      if (!allowed) {
        logger.warn(
          `⚠️ Rate limit exceeded for sender [${senderId}]: ${currentCount}/${hourlyLimit} sent this hour. Reset in ${Math.round(resetInMs / 1000)}s`
        );
        this.emit('rate_limit_exceeded', {
          senderId,
          currentCount,
          hourlyLimit,
          resetInMs,
        });
      } else {
        logger.debug(
          ` Sender [${senderId}] within limit: ${currentCount}/${hourlyLimit} emails used this hour.`
        );
      }

      return {
        allowed,
        currentCount,
        resetInMs,
      };
    } catch (error: any) {
      logger.error('Failed to execute rate limiter Lua script in Redis:', error.message);
      // Fail safely: allow processing if Redis rate limiting check has an intermittent network hiccup
      return {
        allowed: true,
        currentCount: 1,
        resetInMs: 3600000,
      };
    }
  }

  /**
   * Resets rate limit for a sender (useful for testing & manual override)
   */
  async resetLimit(senderId: string): Promise<void> {
    const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));
    const key = `ratelimit:sender:${senderId}:hour:${currentHour}`;
    await redisClient.del(key);
    logger.info(`Rate limit counter reset for sender: ${senderId}`);
  }
}

export const rateLimiterService = new RateLimiterService();
