import { createConfig, z } from '@minibank/config';

export const GATEWAY_CONFIG = Symbol('GATEWAY_CONFIG');

export const gatewayConfig = createConfig({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  GATEWAY_PORT: z.string().default('3000'),

  GATEWAY_JWT_ACCESS_PUBLIC_KEY_BASE64: z.string().min(1),

  AUTH_SERVICE_URL: z.string().url(),
  ACCOUNTS_SERVICE_URL: z.string().url(),
  TRANSFERS_SERVICE_URL: z.string().url(),

  GATEWAY_RATE_LIMIT_MAX: z.coerce.number().default(100),
  GATEWAY_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type GatewayConfig = typeof gatewayConfig;
