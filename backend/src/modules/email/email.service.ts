import { prisma, isDatabaseConnected } from '../../config/database.js';
import { isRedisConnected } from '../../config/redis.js';
import { schedulerService } from '../scheduler/scheduler.service.js';
import { ScheduleBatchDTO } from '../scheduler/scheduler.types.js';
import { parseRecipientsFromBuffer } from '../../utils/csvParser.js';
import { mailerService } from '../worker/mailer.service.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { logger } from '../../utils/logger.js';

// In-memory fallback stores when PostgreSQL / Redis are not running locally
const inMemoryBatches: any[] = [];
const inMemoryJobs: any[] = [];

export const emailService = {
  async scheduleEmail(
    userId: string,
    data: Omit<ScheduleBatchDTO, 'recipients'> & { recipients?: string[] },
    fileBuffer?: Buffer
  ) {
    let combinedRecipients: string[] = [];

    if (data.recipients && Array.isArray(data.recipients)) {
      combinedRecipients.push(...data.recipients);
    }

    if (fileBuffer) {
      const parsedFromFile = await parseRecipientsFromBuffer(fileBuffer);
      combinedRecipients.push(...parsedFromFile);
    }

    combinedRecipients = Array.from(new Set(combinedRecipients));

    if (combinedRecipients.length === 0) {
      throw new AppError('No recipients provided. Please add emails or upload a CSV file.', 400);
    }

    // If PostgreSQL and Redis are available, use full BullMQ distributed pipeline
    if (isDatabaseConnected && isRedisConnected) {
      return schedulerService.scheduleBatch(userId, {
        ...data,
        recipients: combinedRecipients,
      });
    }

    // In-memory local fallback pipeline (allows testing UI without external Docker services)
    logger.info(`[In-Memory Engine] Scheduling ${combinedRecipients.length} emails for user ${userId}`);
    const batchId = `batch_${Date.now()}`;
    const scheduledDate = new Date(data.scheduledAt);
    const delaySeconds = data.delaySeconds || 2;
    const hourlyLimit = data.hourlyLimit || 100;
    const now = Date.now();
    const initialDelay = Math.max(0, scheduledDate.getTime() - now);

    const newBatch = {
      id: batchId,
      userId,
      senderId: 'snd_default',
      sender: { email: 'developer@reachinbox.ai', name: 'ReachInbox Demo Sender' },
      subject: data.subject,
      body: data.body,
      scheduledAt: scheduledDate.toISOString(),
      delaySeconds,
      hourlyLimit,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
      _count: { recipients: combinedRecipients.length, jobs: combinedRecipients.length },
    };

    inMemoryBatches.unshift(newBatch);

    combinedRecipients.forEach((recipientEmail, index) => {
      const recipientDelay = initialDelay + index * delaySeconds * 1000;
      const plannedTime = new Date(now + recipientDelay);
      const jobId = `job_${batchId}_${index}`;

      const jobRecord = {
        id: jobId,
        emailId: batchId,
        recipientId: `recip_${index}`,
        status: 'DELAYED',
        plannedExecutionTime: plannedTime.toISOString(),
        executedAt: null as string | null,
        retryCount: 0,
        etherealPreviewUrl: null as string | null,
        failureReason: null,
        recipient: { recipientEmail },
        email: {
          subject: data.subject,
          sender: { email: 'developer@reachinbox.ai', name: 'ReachInbox Demo Sender' },
        },
      };

      inMemoryJobs.unshift(jobRecord);

      // In-memory simulation: dispatch to Ethereal SMTP when due
      setTimeout(async () => {
        try {
          const delivery = await mailerService.sendEmail({
            from: '"ReachInbox Demo" <developer@reachinbox.ai>',
            to: recipientEmail,
            subject: data.subject,
            html: data.body,
          });

          jobRecord.status = 'COMPLETED';
          jobRecord.executedAt = new Date().toISOString();
          jobRecord.etherealPreviewUrl = delivery.previewUrl;
          logger.info(`[In-Memory Worker] Delivered to ${recipientEmail} | Preview: ${delivery.previewUrl}`);
        } catch (err: any) {
          jobRecord.status = 'FAILED';
          logger.error(`[In-Memory Worker] Delivery failed for ${recipientEmail}:`, err.message);
        }
      }, Math.min(recipientDelay, 60000)); // Cap to 60s for immediate local testing if desired
    });

    return {
      emailId: batchId,
      totalScheduled: combinedRecipients.length,
      scheduledAt: scheduledDate,
      firstJobExecutionTime: new Date(now + initialDelay),
    };
  },

  async getUserEmails(userId: string) {
    if (isDatabaseConnected) {
      try {
        return await prisma.email.findMany({
          where: { userId },
          include: {
            sender: { select: { email: true, name: true } },
            _count: { select: { recipients: true, jobs: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (err: any) {
        logger.warn('Prisma findMany fallback for emails:', err.message);
      }
    }
    return inMemoryBatches.filter((b) => b.userId === userId);
  },

  async getEmailDetails(userId: string, emailId: string) {
    if (isDatabaseConnected) {
      try {
        const email = await prisma.email.findFirst({
          where: { id: emailId, userId },
          include: {
            sender: true,
            recipients: {
              include: {
                jobs: { include: { deliveryAttempts: true } },
              },
              orderBy: { sequenceIndex: 'asc' },
            },
          },
        });
        if (email) return email;
      } catch (err: any) {
        logger.warn('Prisma getEmailDetails fallback:', err.message);
      }
    }
    const batch = inMemoryBatches.find((b) => b.id === emailId && b.userId === userId);
    if (!batch) throw new AppError('Email batch not found', 404);
    return batch;
  },

  async getScheduledJobs(userId: string, page = 1, limit = 20) {
    if (isDatabaseConnected) {
      try {
        const skip = (page - 1) * limit;
        const [jobs, total] = await Promise.all([
          prisma.emailJob.findMany({
            where: {
              email: { userId },
              status: { in: ['DELAYED', 'WAITING', 'RESCHEDULED'] },
            },
            include: {
              recipient: { select: { recipientEmail: true } },
              email: {
                select: {
                  subject: true,
                  sender: { select: { email: true, name: true } },
                },
              },
            },
            orderBy: { plannedExecutionTime: 'asc' },
            skip,
            take: limit,
          }),
          prisma.emailJob.count({
            where: {
              email: { userId },
              status: { in: ['DELAYED', 'WAITING', 'RESCHEDULED'] },
            },
          }),
        ]);

        return { jobs, total, page, totalPages: Math.ceil(total / limit) };
      } catch (err: any) {
        logger.warn('Prisma getScheduledJobs fallback:', err.message);
      }
    }

    const delayed = inMemoryJobs.filter((j) => j.status === 'DELAYED' || j.status === 'RESCHEDULED');
    return {
      jobs: delayed.slice((page - 1) * limit, page * limit),
      total: delayed.length,
      page,
      totalPages: Math.ceil(delayed.length / limit) || 1,
    };
  },

  async getSentJobs(userId: string, page = 1, limit = 20) {
    if (isDatabaseConnected) {
      try {
        const skip = (page - 1) * limit;
        const [jobs, total] = await Promise.all([
          prisma.emailJob.findMany({
            where: {
              email: { userId },
              status: 'COMPLETED',
            },
            include: {
              recipient: { select: { recipientEmail: true } },
              email: {
                select: {
                  subject: true,
                  sender: { select: { email: true, name: true } },
                },
              },
            },
            orderBy: { executedAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.emailJob.count({
            where: { email: { userId }, status: 'COMPLETED' },
          }),
        ]);

        return { jobs, total, page, totalPages: Math.ceil(total / limit) };
      } catch (err: any) {
        logger.warn('Prisma getSentJobs fallback:', err.message);
      }
    }

    const sent = inMemoryJobs.filter((j) => j.status === 'COMPLETED');
    return {
      jobs: sent.slice((page - 1) * limit, page * limit),
      total: sent.length,
      page,
      totalPages: Math.ceil(sent.length / limit) || 1,
    };
  },

  async getDashboardStats(userId: string) {
    if (isDatabaseConnected) {
      try {
        const [totalBatches, scheduledJobs, completedJobs, failedJobs, rateLimitedRecipients] =
          await Promise.all([
            prisma.email.count({ where: { userId } }),
            prisma.emailJob.count({
              where: {
                email: { userId },
                status: { in: ['DELAYED', 'WAITING', 'RESCHEDULED'] },
              },
            }),
            prisma.emailJob.count({
              where: { email: { userId }, status: 'COMPLETED' },
            }),
            prisma.emailJob.count({
              where: { email: { userId }, status: 'FAILED' },
            }),
            prisma.emailRecipient.count({
              where: { email: { userId }, status: 'RATE_LIMITED' },
            }),
          ]);

        return {
          totalBatches,
          scheduledJobs,
          completedJobs,
          failedJobs,
          rateLimitedRecipients,
        };
      } catch (err: any) {
        logger.warn('Prisma getDashboardStats fallback:', err.message);
      }
    }

    return {
      totalBatches: inMemoryBatches.length,
      scheduledJobs: inMemoryJobs.filter((j) => j.status === 'DELAYED').length,
      completedJobs: inMemoryJobs.filter((j) => j.status === 'COMPLETED').length,
      failedJobs: inMemoryJobs.filter((j) => j.status === 'FAILED').length,
      rateLimitedRecipients: 0,
    };
  },
};
