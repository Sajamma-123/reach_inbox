import { Request, Response, NextFunction } from 'express';
import { slackService } from './slack.service.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middlewares/errorHandler.js';

export const slackController = {
  /**
   * Generates Slack OAuth authorization redirect
   */
  connectSlack(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }
    const state = req.user.userId;
    const url = slackService.getSlackAuthUrl(state);
    res.json({ success: true, url });
  },

  /**
   * Direct browser redirect to Slack OAuth
   */
  initiateSlackOAuth(req: Request, res: Response) {
    const userId = (req.query.userId as string) || (req.user?.userId as string);
    if (!userId) {
      return res.redirect(`${env.CLIENT_URL}/dashboard?slack=unauthorized`);
    }
    const url = slackService.getSlackAuthUrl(userId);
    res.redirect(url);
  },

  /**
   * Handles OAuth callback from Slack
   */
  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.query.code as string;
      const userId = req.query.state as string;

      if (!code || !userId) {
        throw new AppError('Missing code or state in Slack callback', 400);
      }

      await slackService.handleSlackCallback(code, userId);
      res.redirect(`${env.CLIENT_URL}/dashboard?slack=connected`);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves active Slack connection status
   */
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const connection = await prisma.slackConnection.findUnique({
        where: { userId: req.user.userId },
        select: {
          id: true,
          slackTeamName: true,
          channelName: true,
          isActive: true,
          connectedAt: true,
        },
      });

      res.json({
        success: true,
        connected: !!connection && connection.isActive,
        connection: connection || null,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Disconnects Slack integration
   */
  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      await slackService.disconnectSlack(req.user.userId);
      res.json({
        success: true,
        message: 'Slack disconnected successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Saves custom Slack Incoming Webhook
   */
  async saveWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const { webhookUrl, channelName } = req.body;
      if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://hooks.slack.com/')) {
        throw new AppError('Please provide a valid Slack Webhook URL starting with https://hooks.slack.com/', 400);
      }

      const connection = await slackService.saveWebhook(req.user.userId, webhookUrl, channelName || '#general');
      res.json({
        success: true,
        message: 'Slack webhook saved and activated successfully!',
        connection: {
          slackTeamName: connection.slackTeamName,
          channelName: connection.channelName,
          isActive: connection.isActive,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Dispatches a test rate limit notification to verify connection
   */
  async sendTestNotification(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const sent = await slackService.sendRateLimitNotification(req.user.userId, {
        senderEmail: req.user.email,
        hourlyLimit: 50,
        currentCount: 50,
        resetInMs: 1800000,
      });

      res.json({
        success: true,
        sent,
        message: sent
          ? 'Test notification successfully posted to Slack!'
          : 'Could not send test notification. Please verify your Slack Webhook URL or connect Slack.',
      });
    } catch (error) {
      next(error);
    }
  },
};
