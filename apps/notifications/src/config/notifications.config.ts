import { createConfig, z } from '@minibank/config';

export const NOTIFICATIONS_CONFIG = Symbol('NOTIFICATIONS_CONFIG');

export const notificationsConfig = createConfig({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  NOTIFICATIONS_PORT: z.string().default('3004'),

  RABBITMQ_URL: z.string().min(1),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.string().default('1025'),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  EMAIL_FROM: z.string().email(),

  AUTH_SERVICE_URL: z.string().min(1),
  AUTH_INTERNAL_API_KEY: z.string().min(15),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type NotificationsConfig = typeof notificationsConfig;
