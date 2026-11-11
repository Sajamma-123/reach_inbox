import { prisma } from '../../config/database.js';
import { emailQueue } from './queue.js';
import { EmailJobPayload, ScheduleBatchDTO } from './scheduler.types.js';
import { searchService } from '../search/search.service.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';

export const schedulerService = {
  /**
   * Orchestrates email campaign batch creation and delayed job enqueuing
   */
  async scheduleBatch(userId: string, data: ScheduleBatchDTO) {
    const {
      senderId: requestedSenderId,
      subject,
      body,
      recipients: rawRecipients,
      scheduledAt: scheduledAtString,
      delaySeconds = 2,
      hourlyLimit = 100,
    } = data;

    // 1. Resolve Sender
    let senderId = requestedSenderId;
    if (!senderId) {
      const defaultSender = await prisma.sender.findFirst({
        where: { userId, isDefault: true },
      });
      if (!defaultSender) {
        const anySender = await prisma.sender.findFirst({ where: { userId } });
        if (!anySender) {
          throw new AppError('No sender identity configured for user.', 400);
        }
        senderId = anySender.id;
      } else {
        senderId = defaultSender.id;
      }
    }

    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!sender || sender.userId !== userId) {
      throw new AppError('Invalid sender selected', 400);
    }

    // 2. Validate & Sanitize Recipients
    const recipients = Array.from(
      new Set(
        rawRecipients
          .map((r) => r.trim().toLowerCase())
          .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
      )
    );

    if (recipients.length === 0) {
      throw new AppError('No valid recipient email addresses provided', 400);
    }

    const scheduledDate = new Date(scheduledAtString);
    if (isNaN(scheduledDate.getTime())) {
      throw new AppError('Invalid scheduled date/time provided', 400);
    }

    const now = Date.now();
    const initialDelay = Math.max(0, scheduledDate.getTime() - now);

    logger.info(
      `📅 Scheduling ${recipients.length} emails for user [${userId}] starting at ${scheduledDate.toISOString()} with ${delaySeconds}s delay`
    );

    // 3. Database Persistence (Email + Recipients)
    const emailRecord = await prisma.email.create({
      data: {
        userId,
        senderId: sender.id,
        subject,
        body,
        scheduledAt: scheduledDate,
        delaySeconds,
        hourlyLimit,
        status: 'SCHEDULED',
        recipients: {
          create: recipients.map((email, index) => ({
            recipientEmail: email,
            sequenceIndex: index,
            status: 'PENDING',
          })),
        },
      },
      include: {
        recipients: true,
      },
    });

    // 4. Enqueue BullMQ Delayed Jobs
    const jobsToCreate = [];

    for (let i = 0; i < emailRecord.recipients.length; i++) {
      const recipient = emailRecord.recipients[i];
      const delayForRecipient = initialDelay + i * delaySeconds * 1000;
      const plannedExecutionTime = new Date(now + delayForRecipient);
      const jobId = `job_${emailRecord.id}_${recipient.id}`;

      const payload: EmailJobPayload = {
        emailId: emailRecord.id,
        recipientId: recipient.id,
        senderId: sender.id,
        senderEmail: sender.email,
        senderName: sender.name,
        toEmail: recipient.recipientEmail,
        subject,
        body,
        hourlyLimit,
        delaySeconds,
        sequenceIndex: i,
        attemptNumber: 1,
      };

      // Create EmailJob row in PostgreSQL
      jobsToCreate.push(
        prisma.emailJob.create({
          data: {
            id: jobId,
            emailId: emailRecord.id,
            recipientId: recipient.id,
            status: 'DELAYED',
            plannedExecutionTime,
          },
        })
      );

      // Add to BullMQ with delay
      await emailQueue.add('send-email', payload, {
        delay: delayForRecipient,
        jobId,
      });

      // Index initial status into Elasticsearch
      searchService.indexEmail({
        emailId: emailRecord.id,
        userId,
        senderEmail: sender.email,
        subject,
        body,
        recipientEmail: recipient.recipientEmail,
        status: 'SCHEDULED',
        scheduledAt: scheduledDate,
        createdAt: new Date(),
      }).catch((err) => logger.warn(`ES indexing error: ${err.message}`));
    }

    await Promise.all(jobsToCreate);

    logger.info(` Successfully scheduled ${jobsToCreate.length} BullMQ jobs for email ${emailRecord.id}`);

    return {
      emailId: emailRecord.id,
      totalScheduled: recipients.length,
      scheduledAt: scheduledDate,
      firstJobExecutionTime: new Date(now + initialDelay),
    };
  },
};
