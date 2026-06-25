import { createConfig, z } from '@minibank/config';

export const TRANSFERS_CONFIG = Symbol('TRANSFERS_CONFIG');

export const transfersConfig = createConfig({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  TRANSFERS_PORT: z.string().default('3003'),

  TRANSFERS_DATABASE_URL: z.string().min(1),

  TRANSFERS_JWT_ACCESS_PUBLIC_KEY_BASE64: z.string().min(1),

  RABBITMQ_URL: z.string().min(1),

  SAGA_POLL_INTERVAL_MS: z.string().default('5000'),

  OUTBOX_POLL_INTERVAL_MS: z.string().default('1000'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),

  ACCOUNTS_SERVICE_URL: z.string().min(1),

  ACCOUNTS_INTERNAL_API_KEY: z.string().min(15),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type TransfersConfig = typeof transfersConfig;
