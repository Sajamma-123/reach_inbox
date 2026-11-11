import { Request, Response, NextFunction } from 'express';
import { searchService } from './search.service.js';
import { AppError } from '../../middlewares/errorHandler.js';

export const searchController = {
  async searchEmails(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const q = (req.query.q as string) || '';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const results = await searchService.searchEmails(req.user.userId, q, limit);

      res.json({
        success: true,
        count: results.length,
        results,
      });
    } catch (error) {
      next(error);
    }
  },
};
