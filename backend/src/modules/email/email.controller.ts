import { Request, Response, NextFunction } from 'express';
import { emailService } from './email.service.js';
import { AppError } from '../../middlewares/errorHandler.js';

export const emailController = {
  /**
   * Schedule new email batch
   */
  async scheduleEmail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const { subject, body, scheduledAt, delaySeconds, hourlyLimit, senderId } = req.body;

      let recipients: string[] = [];
      if (req.body.recipients) {
        if (typeof req.body.recipients === 'string') {
          try {
            recipients = JSON.parse(req.body.recipients);
          } catch {
            recipients = req.body.recipients.split(',').map((e: string) => e.trim());
          }
        } else if (Array.isArray(req.body.recipients)) {
          recipients = req.body.recipients;
        }
      }

      if (!subject || !body || !scheduledAt) {
        throw new AppError('Subject, body, and scheduledAt are required fields.', 400);
      }

      const fileBuffer = req.file?.buffer;

      const result = await emailService.scheduleEmail(
        req.user.userId,
        {
          subject,
          body,
          scheduledAt,
          delaySeconds: delaySeconds ? parseInt(delaySeconds, 10) : 2,
          hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : 100,
          senderId,
          recipients,
        },
        fileBuffer
      );

      res.status(201).json({
        success: true,
        message: 'Emails scheduled successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List all user email campaigns
   */
  async getEmails(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const emails = await emailService.getUserEmails(req.user.userId);
      res.json({
        success: true,
        data: emails,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get single email batch by id
   */
  async getEmailById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const email = await emailService.getEmailDetails(req.user.userId, req.params.id);
      res.json({
        success: true,
        data: email,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Scheduled/Delayed jobs list
   */
  async getScheduledJobs(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const data = await emailService.getScheduledJobs(req.user.userId, page, limit);
      res.json({
        success: true,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Sent email jobs list with Ethereal preview links
   */
  async getSentJobs(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const data = await emailService.getSentJobs(req.user.userId, page, limit);
      res.json({
        success: true,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get metrics for dashboard
   */
  async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const stats = await emailService.getDashboardStats(req.user.userId);
      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      next(error);
    }
  },
};
