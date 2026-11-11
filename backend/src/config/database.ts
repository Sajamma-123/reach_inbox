import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { env } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var prismaClientInstance: PrismaClient | undefined;
}

export let isDatabaseConnected = false;

export const prisma =
  globalThis.prismaClientInstance ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV === 'development') {
  globalThis.prismaClientInstance = prisma;
}

export const connectDatabase = async (): Promise<boolean> => {
  try {
    const connectPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out (2000ms)')), 2000)
    );
    await Promise.race([connectPromise, timeoutPromise]);
    isDatabaseConnected = true;
    logger.info(' Connected to PostgreSQL via Prisma ORM');
    return true;
  } catch (error: any) {
    isDatabaseConnected = false;
    logger.warn(`⚠️ PostgreSQL not reachable on localhost:5432. Local mock/in-memory fallback active.`);
    logger.warn(`   Run 'docker compose up -d' to start PostgreSQL, Redis, and Elasticsearch.`);
    return false;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (isDatabaseConnected) {
    await prisma.$disconnect();
    logger.info('Database disconnected.');
  }
};
