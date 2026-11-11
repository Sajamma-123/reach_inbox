import { prisma } from '../../config/database.js';
import { schedulerService } from '../scheduler/scheduler.service.js';
import { ScheduleBatchDTO } from '../scheduler/scheduler.types.js';
import { parseRecipientsFromBuffer } from '../../utils/csvParser.js';
import { AppError } from '../../middlewares/errorHandler.js';

export const emailService = {
  /**
   * Schedule email batch with optional CSV upload
   */
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

    // Deduplicate
    combinedRecipients = Array.from(new Set(combinedRecipients));

    if (combinedRecipients.length === 0) {
      throw new AppError('No recipients provided. Please add emails or upload a CSV file.', 400);
    }

    return schedulerService.scheduleBatch(userId, {
      ...data,
      recipients: combinedRecipients,
    });
  },

  /**
   * Get all email campaigns/batches for a user
   */
  async getUserEmails(userId: string) {
    const emails = await prisma.email.findMany({
      where: { userId },
      include: {
        sender: {
          select: { email: true, name: true },
        },
        _count: {
          select: {
            recipients: true,
            jobs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return emails;
  },

  /**
   * Get single email batch with full recipient and job breakdown
   */
  async getEmailDetails(userId: string, emailId: string) {
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId },
      include: {
        sender: true,
        recipients: {
          include: {
            jobs: {
              include: {
                deliveryAttempts: true,
              },
            },
          },
          orderBy: { sequenceIndex: 'asc' },
        },
      },
    });

    if (!email) {
      throw new AppError('Email batch not found', 404);
    }

    return email;
  },

  /**
   * Get paginated upcoming scheduled/delayed email jobs
   */
  async getScheduledJobs(userId: string, page = 1, limit = 20) {
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

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get paginated sent emails with Ethereal preview URLs
   */
  async getSentJobs(userId: string, page = 1, limit = 20) {
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
        where: {
          email: { userId },
          status: 'COMPLETED',
        },
      }),
    ]);

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Summary metrics for dashboard cards
   */
  async getDashboardStats(userId: string) {
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
          where: {
            email: { userId },
            status: 'COMPLETED',
          },
        }),
        prisma.emailJob.count({
          where: {
            email: { userId },
            status: 'FAILED',
          },
        }),
        prisma.emailRecipient.count({
          where: {
            email: { userId },
            status: 'RATE_LIMITED',
          },
        }),
      ]);

    return {
      totalBatches,
      scheduledJobs,
      completedJobs,
      failedJobs,
      rateLimitedRecipients,
    };
  },
};
