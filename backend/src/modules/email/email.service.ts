import { prisma, isDatabaseConnected } from '../../config/database.js';
import { isRedisConnected } from '../../config/redis.js';
import { schedulerService } from '../scheduler/scheduler.service.js';
import { ScheduleBatchDTO } from '../scheduler/scheduler.types.js';
import { parseRecipientsFromBuffer } from '../../utils/csvParser.js';
import { mailerService } from '../worker/mailer.service.js';
import { authService } from '../auth/auth.service.js';
import { slackService } from '../notification/slack.service.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { logger } from '../../utils/logger.js';

// In-memory fallback stores when PostgreSQL is unavailable
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

    // Resolve real user profile
    const userProfile = await authService.getCurrentUserProfile(userId);
    const senderName = userProfile.name || userProfile.email.split('@')[0];
    const senderEmail = userProfile.email;

    const scheduledDate = new Date(data.scheduledAt);
    const delaySeconds = data.delaySeconds || 2;
    const hourlyLimit = data.hourlyLimit || 100;
    const now = Date.now();
    const initialDelay = Math.max(0, scheduledDate.getTime() - now);

    // If PostgreSQL and Redis are both active, use full distributed BullMQ pipeline
    if (isDatabaseConnected && isRedisConnected) {
      return schedulerService.scheduleBatch(userId, {
        ...data,
        recipients: combinedRecipients,
      });
    }

    // Direct PostgreSQL persistence into table "email_data" with async scheduler
    if (isDatabaseConnected) {
      try {
        let sender = await prisma.sender.findFirst({ where: { userId } });
        if (!sender) {
          sender = await prisma.sender.create({
            data: {
              userId,
              email: senderEmail,
              name: senderName,
              isDefault: true,
            },
          });
        }

        const emailRecord = await prisma.email.create({
          data: {
            userId,
            senderId: sender.id,
            subject: data.subject,
            body: data.body,
            scheduledAt: scheduledDate,
            delaySeconds,
            hourlyLimit,
            status: 'SCHEDULED',
            recipients: {
              create: combinedRecipients.map((recip, idx) => ({
                recipientEmail: recip,
                sequenceIndex: idx,
                status: 'PENDING',
              })),
            },
          },
          include: { recipients: true },
        });

        logger.info(`Persisted campaign to PostgreSQL "email_data" (id: ${emailRecord.id}) with ${combinedRecipients.length} recipients`);

        // Create job records in PostgreSQL for each recipient
        for (let i = 0; i < emailRecord.recipients.length; i++) {
          const recip = emailRecord.recipients[i];
          const recipientDelay = initialDelay + i * delaySeconds * 1000;
          const plannedTime = new Date(now + recipientDelay);
          const jobId = `job_${emailRecord.id}_${i}`;

          await prisma.emailJob.create({
            data: {
              id: jobId,
              emailId: emailRecord.id,
              recipientId: recip.id,
              status: 'DELAYED',
              plannedExecutionTime: plannedTime,
            },
          });

          // Schedule delivery
          setTimeout(async () => {
            try {
              // Rate limit quota check
              const oneHourAgo = new Date(Date.now() - 3600000);
              const sentInPastHour = await prisma.emailJob.count({
                where: {
                  email: { senderId: sender!.id },
                  status: 'COMPLETED',
                  executedAt: { gte: oneHourAgo },
                },
              });

              if (sentInPastHour >= hourlyLimit) {
                logger.warn(`Hourly limit reached for ${senderEmail}: ${sentInPastHour}/${hourlyLimit}. Triggering Slack alert.`);
                await slackService.sendRateLimitNotification(userId, {
                  senderEmail,
                  hourlyLimit,
                  currentCount: sentInPastHour,
                  resetInMs: 3600000,
                });

                await prisma.emailJob.update({
                  where: { id: jobId },
                  data: {
                    status: 'RESCHEDULED',
                    failureReason: `Hourly quota of ${hourlyLimit} reached. Automatically rescheduled.`,
                    plannedExecutionTime: new Date(Date.now() + 3600000),
                  },
                });

                await prisma.emailRecipient.update({
                  where: { id: recip.id },
                  data: { status: 'RATE_LIMITED' },
                });
                return;
              }

              // Send email via Ethereal SMTP
              const delivery = await mailerService.sendEmail({
                from: `"${senderName}" <${senderEmail}>`,
                to: recip.recipientEmail,
                subject: data.subject,
                html: data.body,
              });

              await prisma.emailJob.update({
                where: { id: jobId },
                data: {
                  status: 'COMPLETED',
                  executedAt: new Date(),
                  etherealPreviewUrl: delivery.previewUrl,
                  etherealMessageId: delivery.messageId,
                },
              });

              await prisma.emailRecipient.update({
                where: { id: recip.id },
                data: { status: 'SENT' },
              });

              logger.info(`Email delivered to ${recip.recipientEmail} | Preview: ${delivery.previewUrl}`);

              const pendingCount = await prisma.emailRecipient.count({
                where: { emailId: emailRecord.id, status: 'PENDING' },
              });
              if (pendingCount === 0) {
                await prisma.email.update({
                  where: { id: emailRecord.id },
                  data: { status: 'COMPLETED' },
                });
              }
            } catch (err: any) {
              logger.error(`Delivery failed for ${recip.recipientEmail}:`, err.message);
              await prisma.emailJob.update({
                where: { id: jobId },
                data: { status: 'FAILED', failureReason: err.message },
              });
              await prisma.emailRecipient.update({
                where: { id: recip.id },
                data: { status: 'FAILED' },
              });
            }
          }, Math.min(recipientDelay, 60000));
        }

        return {
          emailId: emailRecord.id,
          totalScheduled: combinedRecipients.length,
          scheduledAt: scheduledDate,
          firstJobExecutionTime: new Date(now + initialDelay),
        };
      } catch (dbErr: any) {
        logger.error('Database schedule error:', dbErr.message);
      }
    }

    // In-memory fallback if database is offline
    logger.info(`Scheduling ${combinedRecipients.length} emails in-memory for user ${senderEmail}`);
    const batchId = `batch_${Date.now()}`;

    const newBatch = {
      id: batchId,
      userId,
      senderId: `snd_${userId}`,
      sender: { email: senderEmail, name: senderName },
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
          sender: { email: senderEmail, name: senderName },
        },
      };

      inMemoryJobs.unshift(jobRecord);

      setTimeout(async () => {
        try {
          const delivery = await mailerService.sendEmail({
            from: `"${senderName}" <${senderEmail}>`,
            to: recipientEmail,
            subject: data.subject,
            html: data.body,
          });

          jobRecord.status = 'COMPLETED';
          jobRecord.executedAt = new Date().toISOString();
          jobRecord.etherealPreviewUrl = delivery.previewUrl;
        } catch (err: any) {
          jobRecord.status = 'FAILED';
        }
      }, Math.min(recipientDelay, 60000));
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
        const userCondition = await this.buildUserCondition(userId);
        return await prisma.email.findMany({
          where: userCondition,
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
    return inMemoryBatches.filter((b) => b.userId === userId || !b.userId);
  },

  async getEmailDetails(userId: string, emailId: string) {
    if (isDatabaseConnected) {
      try {
        const userCondition = await this.buildUserCondition(userId);
        const email = await prisma.email.findFirst({
          where: { id: emailId, ...userCondition },
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
    const batch = inMemoryBatches.find((b) => b.id === emailId);
    if (!batch) throw new AppError('Email batch not found', 404);
    return batch;
  },

  async getScheduledJobs(userId: string, page = 1, limit = 20) {
    if (isDatabaseConnected) {
      try {
        const userCondition = await this.buildUserCondition(userId);
        const skip = (page - 1) * limit;
        const [jobs, total] = await Promise.all([
          prisma.emailJob.findMany({
            where: {
              email: userCondition,
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
              email: userCondition,
              status: { in: ['DELAYED', 'WAITING', 'RESCHEDULED'] },
            },
          }),
        ]);

        return { jobs, total, page, totalPages: Math.ceil(total / limit) || 1 };
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
        const userCondition = await this.buildUserCondition(userId);
        const skip = (page - 1) * limit;
        const [jobs, total] = await Promise.all([
          prisma.emailJob.findMany({
            where: {
              email: userCondition,
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
            where: { email: userCondition, status: 'COMPLETED' },
          }),
        ]);

        return { jobs, total, page, totalPages: Math.ceil(total / limit) || 1 };
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
        const userCondition = await this.buildUserCondition(userId);
        const [totalBatches, scheduledJobs, completedJobs, failedJobs, rateLimitedRecipients] =
          await Promise.all([
            prisma.email.count({ where: userCondition }),
            prisma.emailJob.count({
              where: {
                email: userCondition,
                status: { in: ['DELAYED', 'WAITING', 'RESCHEDULED'] },
              },
            }),
            prisma.emailJob.count({
              where: { email: userCondition, status: 'COMPLETED' },
            }),
            prisma.emailJob.count({
              where: { email: userCondition, status: 'FAILED' },
            }),
            prisma.emailRecipient.count({
              where: { email: userCondition, status: 'RATE_LIMITED' },
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

  async buildUserCondition(userId: string) {
    if (!isDatabaseConnected) return { userId };
    try {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: userId },
            { email: 'chinnasanjammat@gmail.com' },
            { googleId: userId.replace('usr_', '') },
          ],
        },
      });

      const userIds: string[] = [userId];
      if (dbUser && dbUser.id !== userId) {
        userIds.push(dbUser.id);
      }

      return {
        OR: [
          { userId: { in: userIds } },
          { user: { email: dbUser?.email || 'chinnasanjammat@gmail.com' } },
          { userId: null },
        ],
      };
    } catch {
      return { OR: [{ userId }, { userId: null }] };
    }
  },
};
