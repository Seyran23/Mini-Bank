import { createConfig, z } from '@minibank/config';

export const ACCOUNTS_CONFIG = Symbol('ACCOUNTS_CONFIG');

export const accountsConfig = createConfig({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  ACCOUNTS_PORT: z.string().default('3002'),

  ACCOUNTS_DATABASE_URL: z.string().min(1),

  ACCOUNTS_JWT_ACCESS_PUBLIC_KEY_BASE64: z.string().min(1),

  ACCOUNTS_INTERNAL_API_KEY: z.string().min(15),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type AccountsConfig = typeof accountsConfig;
