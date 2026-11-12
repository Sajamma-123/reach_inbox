import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middlewares/errorHandler.js';

export const authController = {
  /**
   * Redirects to Google OAuth 2.0 Consent Screen
   */
  initiateGoogleLogin(_req: Request, res: Response) {
    const url = authService.getGoogleAuthUrl();
    res.redirect(url);
  },

  /**
   * Returns Google OAuth URL as JSON for clients requesting via AJAX
   */
  getGoogleAuthUrl(_req: Request, res: Response) {
    const url = authService.getGoogleAuthUrl();
    res.json({ success: true, url });
  },

  /**
   * Google OAuth Callback
   */
  async handleGoogleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.query.code as string;
      if (!code) {
        throw new AppError('Authorization code missing in Google callback', 400);
      }

      const { token } = await authService.handleGoogleCallback(code);

      // Set HTTP-only secure cookie
      res.cookie('reachinbox_token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect user to React Dashboard with token for cross-port persistence
      res.redirect(`${env.CLIENT_URL}/?token=${token}`);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Returns profile of currently authenticated user
   */
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const profile = await authService.getCurrentUserProfile(req.user.userId);
      res.json({
        success: true,
        user: profile,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Logs out user and destroys cookie
   */
  async logout(_req: Request, res: Response) {
    res.clearCookie('reachinbox_token');
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  },
};
