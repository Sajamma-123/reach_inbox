import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';

export interface UserSessionPayload {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

const googleClient = new OAuth2Client({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_CALLBACK_URL,
});

export const authService = {
  /**
   * Generates Google OAuth 2.0 Consent URL
   */
  getGoogleAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    return googleClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
    });
  },

  /**
   * Exchanges Google Auth Code for profile and session token
   */
  async handleGoogleCallback(code: string): Promise<{ token: string; user: UserSessionPayload }> {
    try {
      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      if (!tokens.id_token) {
        throw new AppError('Missing Google ID token', 400);
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new AppError('Unable to extract user profile from Google', 400);
      }

      const email = payload.email.toLowerCase();
      const googleId = payload.sub;
      const name = payload.name || email.split('@')[0];
      const avatarUrl = payload.picture || '';

      // Upsert User
      const user = await prisma.user.upsert({
        where: { googleId },
        update: {
          name,
          avatarUrl,
          updatedAt: new Date(),
        },
        create: {
          email,
          name,
          googleId,
          avatarUrl,
        },
      });

      // Ensure user has at least one default sender identity
      const defaultSender = await prisma.sender.findFirst({
        where: { userId: user.id },
      });

      if (!defaultSender) {
        await prisma.sender.create({
          data: {
            userId: user.id,
            email: user.email,
            name: user.name || 'Default Sender',
            isDefault: true,
          },
        });
      }

      const sessionPayload: UserSessionPayload = {
        userId: user.id,
        email: user.email,
        name: user.name || '',
        avatarUrl: user.avatarUrl || undefined,
      };

      const token = this.generateSessionToken(sessionPayload);

      return { token, user: sessionPayload };
    } catch (error: any) {
      logger.error('Google OAuth callback failed:', error.message);
      throw new AppError(error.message || 'Google authentication failed', 401);
    }
  },

  /**
   * Creates or retrieves a local demo/test user for quick evaluation without Google UI
   */
  async getOrCreateDemoUser(): Promise<{ token: string; user: UserSessionPayload }> {
    const demoEmail = 'developer@reachinbox.ai';
    const demoGoogleId = 'reachinbox_demo_account_12345';

    const user = await prisma.user.upsert({
      where: { googleId: demoGoogleId },
      update: {},
      create: {
        email: demoEmail,
        name: 'ReachInbox Demo User',
        googleId: demoGoogleId,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      },
    });

    const existingSender = await prisma.sender.findFirst({
      where: { userId: user.id },
    });

    if (!existingSender) {
      await prisma.sender.create({
        data: {
          userId: user.id,
          email: user.email,
          name: user.name || 'Demo Sender',
          isDefault: true,
        },
      });
    }

    const sessionPayload: UserSessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name || 'Demo User',
      avatarUrl: user.avatarUrl || undefined,
    };

    const token = this.generateSessionToken(sessionPayload);
    return { token, user: sessionPayload };
  },

  /**
   * Generates signed JWT for authenticated sessions
   */
  generateSessionToken(payload: UserSessionPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '7d',
    });
  },

  /**
   * Decodes and validates JWT token
   */
  verifySessionToken(token: string): UserSessionPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as UserSessionPayload;
    } catch (err) {
      throw new AppError('Invalid or expired authentication session', 401);
    }
  },

  /**
   * Fetch current user info with sender identities and slack status
   */
  async getCurrentUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        senders: true,
        slackConnection: {
          select: {
            id: true,
            slackTeamName: true,
            channelName: true,
            isActive: true,
            connectedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  },
};
