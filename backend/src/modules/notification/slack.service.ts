import axios from 'axios';
import { WebClient } from '@slack/web-api';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';

export class SlackService {
  /**
   * Generates Slack OAuth 2.0 Install URL
   */
  getSlackAuthUrl(state: string): string {
    const scopes = ['chat:write', 'incoming-webhook'];
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID || '',
      scope: scopes.join(','),
      redirect_uri: env.SLACK_REDIRECT_URI,
      state: state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchanges code for Slack OAuth Access Token
   */
  async handleSlackCallback(code: string, userId: string) {
    try {
      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: env.SLACK_CLIENT_ID || '',
          client_secret: env.SLACK_CLIENT_SECRET || '',
          code,
          redirect_uri: env.SLACK_REDIRECT_URI,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const data = response.data;
      if (!data.ok) {
        throw new AppError(`Slack OAuth error: ${data.error}`, 400);
      }

      const teamId = data.team?.id || '';
      const teamName = data.team?.name || '';
      const channelId = data.incoming_webhook?.channel_id || '';
      const channelName = data.incoming_webhook?.channel || '';
      const webhookUrl = data.incoming_webhook?.url || '';
      const accessToken = data.access_token || '';

      const slackConnection = await prisma.slackConnection.upsert({
        where: { userId },
        update: {
          slackTeamId: teamId,
          slackTeamName: teamName,
          channelId,
          channelName,
          webhookUrl,
          accessToken,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          slackTeamId: teamId,
          slackTeamName: teamName,
          channelId,
          channelName,
          webhookUrl,
          accessToken,
          isActive: true,
        },
      });

      logger.info(` Slack workspace connected: ${teamName} (Channel: ${channelName}) for user ${userId}`);
      return slackConnection;
    } catch (error: any) {
      logger.error('Slack OAuth exchange failed:', error.message);
      throw new AppError(error.message || 'Slack connection failed', 500);
    }
  }

  /**
   * Dispatches Rate Limit Alert to connected Slack Channel
   */
  async sendRateLimitNotification(
    userId: string,
    details: {
      senderEmail: string;
      hourlyLimit: number;
      currentCount: number;
      resetInMs: number;
    }
  ): Promise<boolean> {
    try {
      let webhookUrl = env.SLACK_WEBHOOK_URL || '';
      let accessToken = '';
      let channelId = '';

      if (userId) {
        const connection = await prisma.slackConnection.findUnique({
          where: { userId },
        });

        if (connection && connection.isActive) {
          if (connection.webhookUrl) webhookUrl = connection.webhookUrl;
          if (connection.accessToken) accessToken = connection.accessToken;
          if (connection.channelId) channelId = connection.channelId;
        }
      }

      if (!webhookUrl && (!accessToken || !channelId)) {
        logger.debug(`No active Slack connection or webhook configured. Skipping notification.`);
        return false;
      }

      const resetMinutes = Math.ceil(details.resetInMs / 60000);
      const text = `🚨 *ReachInbox Rate Limit Alert*: Hourly sending limit reached for \`${details.senderEmail}\` (${details.currentCount}/${details.hourlyLimit} emails sent). Pending jobs are paused and rescheduled to resume in ~${resetMinutes} minutes.`;

      // 1. Try sending via Webhook URL
      if (webhookUrl) {
        await axios.post(webhookUrl, {
          text,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '⚠️ ReachInbox: Hourly Rate Limit Reached',
                emoji: true,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Sender:*\n${details.senderEmail}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Hourly Quota:*\n${details.hourlyLimit} emails/hr`,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Status:* Limit reached (${details.currentCount} sent). Remaining emails in this batch have been automatically rescheduled for the next window (~${resetMinutes} min). No emails will be dropped.`,
              },
            },
          ],
        });
        logger.info(`📢 Slack rate limit alert sent via Webhook to ${webhookUrl.slice(0, 30)}...`);
        return true;
      }

      // 2. Try sending via WebClient Bot token
      if (accessToken && channelId) {
        const client = new WebClient(accessToken);
        await client.chat.postMessage({
          channel: channelId,
          text,
        });
        logger.info(`📢 Slack rate limit alert sent via Bot API to channel ${channelId}`);
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Failed to dispatch Slack rate limit notification:', error.message);
      return false;
    }
  }

  /**
   * Saves an incoming webhook URL directly for user
   */
  async saveWebhook(userId: string, webhookUrl: string, channelName = '#general') {
    const connection = await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        webhookUrl,
        channelName,
        slackTeamId: 'webhook-direct',
        slackTeamName: 'Slack Webhook',
        accessToken: '',
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        webhookUrl,
        channelName,
        slackTeamId: 'webhook-direct',
        slackTeamName: 'Slack Webhook',
        accessToken: '',
        isActive: true,
      },
    });
    logger.info(`Saved Slack webhook for user ${userId}`);
    return connection;
  }

  /**
   * Disconnects user's Slack integration
   */
  async disconnectSlack(userId: string) {
    await prisma.slackConnection.updateMany({
      where: { userId },
      data: { isActive: false },
    });
    logger.info(`Slack disconnected for user ${userId}`);
  }
}

export const slackService = new SlackService();
