import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError) {
    logger.warn(`Validation error on ${req.method} ${req.originalUrl}:`, err.errors);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof AppError) {
    logger.warn(`Operational error: [${err.statusCode}] ${err.message}`);
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  logger.error(`Unhandled Exception on ${req.method} ${req.originalUrl}:`, err.stack || err.message);

  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' ? { details: err.message } : {}),
  });
};
