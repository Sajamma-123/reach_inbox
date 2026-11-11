import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma, isDatabaseConnected } from '../../config/database.js';
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

// In-memory demo profile fallback if DB is not yet running
const demoProfileFallback = {
  id: 'usr_demo_reachinbox',
  email: 'developer@reachinbox.ai',
  name: 'ReachInbox Demo User',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  googleId: 'demo_reachinbox_123',
  senders: [
    {
      id: 'snd_default',
      userId: 'usr_demo_reachinbox',
      email: 'developer@reachinbox.ai',
      name: 'ReachInbox Demo Sender',
      isDefault: true,
    },
  ],
  slackConnection: null,
};

export const authService = {
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

      let userId = `usr_${googleId.slice(0, 10)}`;

      if (isDatabaseConnected) {
        const user = await prisma.user.upsert({
          where: { googleId },
          update: { name, avatarUrl, updatedAt: new Date() },
          create: { email, name, googleId, avatarUrl },
        });
        userId = user.id;

        const defaultSender = await prisma.sender.findFirst({ where: { userId: user.id } });
        if (!defaultSender) {
          await prisma.sender.create({
            data: { userId: user.id, email: user.email, name: user.name || 'Default Sender', isDefault: true },
          });
        }
      }

      const sessionPayload: UserSessionPayload = {
        userId,
        email,
        name,
        avatarUrl,
      };

      const token = this.generateSessionToken(sessionPayload);
      return { token, user: sessionPayload };
    } catch (error: any) {
      logger.error('Google OAuth callback failed:', error.message);
      throw new AppError(error.message || 'Google authentication failed', 401);
    }
  },

  async getOrCreateDemoUser(): Promise<{ token: string; user: UserSessionPayload }> {
    const demoEmail = 'developer@reachinbox.ai';
    const demoGoogleId = 'reachinbox_demo_account_12345';
    let userId = 'usr_demo_reachinbox';

    if (isDatabaseConnected) {
      try {
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
        userId = user.id;

        const existingSender = await prisma.sender.findFirst({ where: { userId: user.id } });
        if (!existingSender) {
          await prisma.sender.create({
            data: { userId: user.id, email: user.email, name: user.name || 'Demo Sender', isDefault: true },
          });
        }
      } catch (err: any) {
        logger.warn('Prisma upsert fallback for demo user:', err.message);
      }
    }

    const sessionPayload: UserSessionPayload = {
      userId,
      email: demoEmail,
      name: 'ReachInbox Demo User',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    };

    const token = this.generateSessionToken(sessionPayload);
    return { token, user: sessionPayload };
  },

  generateSessionToken(payload: UserSessionPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
  },

  verifySessionToken(token: string): UserSessionPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as UserSessionPayload;
    } catch {
      throw new AppError('Invalid or expired authentication session', 401);
    }
  },

  async getCurrentUserProfile(userId: string) {
    if (isDatabaseConnected) {
      try {
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
        if (user) return user;
      } catch (err: any) {
        logger.warn('Prisma findUnique fallback for profile:', err.message);
      }
    }

    // Return in-memory fallback user
    return {
      ...demoProfileFallback,
      id: userId,
    };
  },
};
