import { Request, Response, NextFunction } from 'express';
import { authService, UserSessionPayload } from './auth.service.js';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { AppError } from '../../middlewares/errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserSessionPayload;
    }
  }
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token = req.cookies?.reachinbox_token;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const payload = authService.verifySessionToken(token);
    req.user = payload;

    // Synchronize user ID with real PostgreSQL User record
    if (isDatabaseConnected) {
      try {
        const dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: payload.userId },
              { email: payload.email.toLowerCase() },
              { googleId: payload.userId.replace('usr_', '') },
            ],
          },
        });
        if (dbUser) {
          req.user.userId = dbUser.id;
          req.user.email = dbUser.email;
          req.user.name = dbUser.name || payload.name;
        }
      } catch (dbErr) {
        // Fallback to token payload
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
