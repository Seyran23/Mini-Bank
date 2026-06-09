import pino from 'pino';

export type Logger = pino.Logger;
export type { LoggerOptions } from 'pino';

export function createLogger(service: string): Logger {
  const isDev = process.env['NODE_ENV'] !== 'production';

  return pino({
    name: service,
    level: process.env['LOG_LEVEL'] ?? 'info',
    formatters: {
      level: (label) => ({ level: label }),
    },
    ...(isDev && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, singleLine: false },
      },
    }),
  });
}

export { pino };
