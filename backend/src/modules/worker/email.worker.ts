import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, emailQueue } from '../scheduler/queue.js';
import { redisOptions } from '../../config/redis.js';
import { EmailJobPayload } from '../scheduler/scheduler.types.js';
import { mailerService } from './mailer.service.js';
import { rateLimiterService } from '../rate-limiter/rate-limiter.service.js';
import { slackService } from '../notification/slack.service.js';
import { searchService } from '../search/search.service.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

export const createEmailWorker = () => {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const {
        emailId,
        recipientId,
        senderId,
        senderEmail,
        senderName,
        toEmail,
        subject,
        body,
        hourlyLimit,
        attemptNumber = 1,
      } = job.data;

      logger.info(` Processing job [${job.id}] for recipient ${toEmail} (Attempt ${attemptNumber})`);

      // 1. Idempotency Check (Duplicate Prevention)
      const recipient = await prisma.emailRecipient.findUnique({
        where: { id: recipientId },
        include: { email: true },
      });

      if (!recipient) {
        logger.warn(`Recipient [${recipientId}] not found in DB. Dropping job.`);
        return { status: 'SKIPPED_NOT_FOUND' };
      }

      if (recipient.status === 'SENT') {
        logger.warn(`Recipient [${toEmail}] already marked SENT. Skipping duplicate execution.`);
        return { status: 'SKIPPED_ALREADY_SENT' };
      }

      // 2. Distributed Rate Limiting Check (Atomic Redis Counter)
      const rateLimitResult = await rateLimiterService.checkAndIncrement(senderId, hourlyLimit);

      if (!rateLimitResult.allowed) {
        const resetDelay = rateLimitResult.resetInMs;
        logger.warn(
          ` Sender [${senderEmail}] hit hourly limit of ${hourlyLimit}. Rescheduling recipient [${toEmail}] in ${Math.round(resetDelay / 1000)}s`
        );

        // Update Job & Recipient DB status to RATE_LIMITED / RESCHEDULED
        await prisma.$transaction([
          prisma.emailRecipient.update({
            where: { id: recipientId },
            data: { status: 'RATE_LIMITED' },
          }),
          prisma.emailJob.update({
            where: { id: job.id as string },
            data: {
              status: 'RESCHEDULED',
              plannedExecutionTime: new Date(Date.now() + resetDelay),
              failureReason: `Hourly quota exceeded (${rateLimitResult.currentCount}/${hourlyLimit}). Auto-rescheduled for next window.`,
            },
          }),
        ]);

        // Reschedule job into BullMQ delayed queue for the next window
        const rescheduledJobId = `${job.id}_r_${Date.now()}`;
        await emailQueue.add(
          'send-email',
          {
            ...job.data,
            attemptNumber: attemptNumber + 1,
          },
          {
            delay: resetDelay,
            jobId: rescheduledJobId,
          }
        );

        // Trigger Slack Notification
        await slackService.sendRateLimitNotification(recipient.email.userId || '', {
          senderEmail,
          hourlyLimit,
          currentCount: rateLimitResult.currentCount,
          resetInMs: resetDelay,
        });

        return { status: 'RESCHEDULED', resetInMs: resetDelay };
      }

      // 3. Dispatch Email via SMTP
      try {
        const fromAddress = `"${senderName}" <${senderEmail}>`;
        const deliveryResult = await mailerService.sendEmail({
          from: fromAddress,
          to: toEmail,
          subject,
          html: body,
        });

        logger.info(` Email delivered to ${toEmail} | Message ID: ${deliveryResult.messageId}`);
        if (deliveryResult.previewUrl) {
          logger.info(`🔗 Ethereal Preview: ${deliveryResult.previewUrl}`);
        }

        // 4. Record Successful Delivery Attempt & Status in DB
        await prisma.$transaction([
          prisma.emailRecipient.update({
            where: { id: recipientId },
            data: { status: 'SENT' },
          }),
          prisma.emailJob.update({
            where: { id: job.id as string },
            data: {
              status: 'COMPLETED',
              executedAt: new Date(),
              etherealMessageId: deliveryResult.messageId,
              etherealPreviewUrl: deliveryResult.previewUrl,
              failureReason: null,
            },
          }),
          prisma.deliveryAttempt.create({
            data: {
              jobId: job.id as string,
              attemptNumber,
              status: 'SUCCESS',
              smtpResponse: deliveryResult.smtpResponse,
            },
          }),
        ]);

        // 5. Update Elasticsearch Document
        await searchService.indexEmail({
          emailId,
          userId: recipient.email.userId || '',
          senderEmail,
          subject,
          body,
          recipientEmail: toEmail,
          status: 'SENT',
          scheduledAt: recipient.email.scheduledAt,
          createdAt: new Date(),
        });

        // Check if all recipients for this email are completed
        const pendingCount = await prisma.emailRecipient.count({
          where: {
            emailId,
            status: { in: ['PENDING', 'RATE_LIMITED'] },
          },
        });

        if (pendingCount === 0) {
          await prisma.email.update({
            where: { id: emailId },
            data: { status: 'COMPLETED' },
          });
          logger.info(` Batch Email [${emailId}] is now fully COMPLETED!`);
        }

        return {
          status: 'SUCCESS',
          messageId: deliveryResult.messageId,
          previewUrl: deliveryResult.previewUrl,
        };
      } catch (smtpError: any) {
        logger.error(`❌ SMTP delivery failed for ${toEmail}:`, smtpError.message);

        // Record Failed Delivery Attempt
        await prisma.$transaction([
          prisma.emailRecipient.update({
            where: { id: recipientId },
            data: { status: 'FAILED' },
          }),
          prisma.emailJob.update({
            where: { id: job.id as string },
            data: {
              status: 'FAILED',
              retryCount: attemptNumber,
              failureReason: smtpError.message,
            },
          }),
          prisma.deliveryAttempt.create({
            data: {
              jobId: job.id as string,
              attemptNumber,
              status: 'FAILURE',
              errorMessage: smtpError.message,
            },
          }),
        ]);

        throw smtpError; // Rethrow to let BullMQ manage retries if attempts remain
      }
    },
    {
      connection: redisOptions,
      concurrency: 5, // Process up to 5 concurrent SMTP deliveries
      limiter: {
        max: 20,
        duration: 1000, // Safe local throttle: max 20 jobs/sec across SMTP connection
      },
    }
  );

  worker.on('ready', () => {
    logger.info(' BullMQ Email Worker initialized and listening for jobs.');
  });

  worker.on('error', (err) => {
    logger.error('❌ BullMQ Email Worker error:', err.message);
  });

  return worker;
};
