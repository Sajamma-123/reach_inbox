import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { env } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var prismaClientInstance: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaClientInstance ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : ['error'],
  });

if (env.NODE_ENV === 'development') {
  globalThis.prismaClientInstance = prisma;

  // Optional query logging
  // (prisma as any).$on('query', (e: any) => {
  //   logger.debug(`Prisma Query: ${e.query} - ${e.duration}ms`);
  // });
}

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info(' Connected to PostgreSQL via Prisma ORM');
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error);
    // In dev mode we log a clear explanation so the developer can run docker-compose or provide DATABASE_URL
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('Database disconnected.');
};
