import { createConfig, z } from '@minibank/config';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export const authConfig = createConfig({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AUTH_PORT: z.string().default('3001'),
  AUTH_DATABASE_URL: z.string().min(1),

  AUTH_JWT_ACCESS_PRIVATE_KEY_BASE64: z.string().min(1),
  AUTH_JWT_ACCESS_PUBLIC_KEY_BASE64: z.string().min(1),
  AUTH_JWT_REFRESH_PRIVATE_KEY_BASE64: z.string().min(1),
  AUTH_JWT_REFRESH_PUBLIC_KEY_BASE64: z.string().min(1),
  AUTH_JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  AUTH_JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  AUTH_INTERNAL_API_KEY: z.string().min(20),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type AuthConfig = typeof authConfig;
