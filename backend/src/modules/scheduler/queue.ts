import { Queue, QueueEvents } from 'bullmq';
import { redisOptions } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import { EmailJobPayload } from './scheduler.types.js';

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs for audit
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisOptions,
});

emailQueueEvents.on('waiting', ({ jobId }) => {
  logger.debug(`[Queue] Job ${jobId} is waiting`);
});

emailQueueEvents.on('completed', ({ jobId }) => {
  logger.info(`[Queue] Job ${jobId} has successfully completed`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`[Queue] Job ${jobId} failed with reason: ${failedReason}`);
});
