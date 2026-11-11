import { Request, Response, NextFunction } from 'express';
import { authService, UserSessionPayload } from './auth.service.js';
import { AppError } from '../../middlewares/errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserSessionPayload;
    }
  }
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
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
    next();
  } catch (error) {
    next(error);
  }
};
