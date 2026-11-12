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

// Real in-memory user registry to ensure user data remains consistent across sessions
const realUsersMap = new Map<string, any>();

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
   * Exchanges Google Auth Code for real Google profile & issues session JWT
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

      let userId = `usr_${googleId.slice(0, 12)}`;

      if (isDatabaseConnected) {
        try {
          const user = await prisma.user.upsert({
            where: { googleId },
            update: { name, avatarUrl, updatedAt: new Date() },
            create: { email, name, googleId, avatarUrl },
          });
          userId = user.id;

          const defaultSender = await prisma.sender.findFirst({ where: { userId: user.id } });
          if (!defaultSender) {
            await prisma.sender.create({
              data: { userId: user.id, email: user.email, name: user.name || name, isDefault: true },
            });
          }
        } catch (dbErr: any) {
          logger.warn('Database upsert warning:', dbErr.message);
        }
      }

      const sessionPayload: UserSessionPayload = {
        userId,
        email,
        name,
        avatarUrl,
      };

      // Store real authenticated profile in memory
      realUsersMap.set(userId, {
        id: userId,
        email,
        name,
        avatarUrl,
        googleId,
        senders: [
          {
            id: `snd_${userId}`,
            userId,
            email,
            name,
            isDefault: true,
          },
        ],
        slackConnection: null,
      });

      logger.info(` Google user authenticated: ${name} (${email})`);

      const token = this.generateSessionToken(sessionPayload);
      return { token, user: sessionPayload };
    } catch (error: any) {
      logger.error('Google OAuth callback failed:', error.message);
      throw new AppError(error.message || 'Google authentication failed', 401);
    }
  },

  /**
   * Generates signed JWT for authenticated sessions
   */
  generateSessionToken(payload: UserSessionPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
  },

  /**
   * Decodes and validates JWT token
   */
  verifySessionToken(token: string): UserSessionPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as UserSessionPayload;
    } catch {
      throw new AppError('Invalid or expired authentication session', 401);
    }
  },

  /**
   * Fetch current user profile with their real Google info and sender profile
   */
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
        logger.warn('Prisma profile query warning:', err.message);
      }
    }

    const cachedUser = realUsersMap.get(userId);
    if (cachedUser) {
      return cachedUser;
    }

    throw new AppError('User profile not found. Please log in with Google.', 401);
  },
};
