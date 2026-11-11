type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const formatTimestamp = (): string => new Date().toISOString();

export const logger = {
  info: (message: string, ...meta: unknown[]) => {
    console.log(`[\x1b[34mINFO\x1b[0m] [${formatTimestamp()}] ${message}`, ...meta);
  },
  warn: (message: string, ...meta: unknown[]) => {
    console.warn(`[\x1b[33mWARN\x1b[0m] [${formatTimestamp()}] ${message}`, ...meta);
  },
  error: (message: string, ...meta: unknown[]) => {
    console.error(`[\x1b[31mERROR\x1b[0m] [${formatTimestamp()}] ${message}`, ...meta);
  },
  debug: (message: string, ...meta: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[\x1b[35mDEBUG\x1b[0m] [${formatTimestamp()}] ${message}`, ...meta);
    }
  },
};
