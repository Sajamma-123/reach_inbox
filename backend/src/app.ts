import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Route imports
import { authRoutes } from './modules/auth/auth.routes.js';
import { emailRoutes } from './modules/email/email.routes.js';
import { slackRoutes } from './modules/notification/slack.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { bullBoardRouter } from './modules/monitoring/bull-board.js';

export const createApp = (): Application => {
  const app = express();

  // Security headers (relaxed for development and bull-board if needed)
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  // CORS configuration for React frontend credentials
  app.use(
    cors({
      origin: [env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Request logging
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

  // Body and cookie parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
    });
  });

  // Base API info
  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      name: 'ReachInbox Email Job Scheduler API',
      version: '1.0.0',
      status: 'operational',
      endpoints: {
        auth: '/api/auth',
        emails: '/api/emails',
        slack: '/api/slack',
        search: '/api/search',
        monitoring: '/admin/queues',
      },
    });
  });

  // Mount API Modules
  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/slack', slackRoutes);
  app.use('/api/search', searchRoutes);

  // Mount Bull-Board Dashboard
  app.use('/admin/queues', bullBoardRouter);

  // Global error handler
  app.use(errorHandler);

  return app;
};
