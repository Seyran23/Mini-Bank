import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

import { AccountsModule } from '@/accounts/accounts.module';
import { AuthModule } from '@/auth/auth.module';
import { MetricsInterceptor } from '@/common/interceptors/metrics.interceptor';
import { GatewayConfigModule } from '@/config/gateway-config.module';
import { gatewayConfig } from '@/config/gateway.config';
import { HealthModule } from '@/health/health.module';
import { TransfersModule } from '@/transfers/transfers.module';

@Module({
  imports: [
    PrometheusModule.register({ defaultMetrics: { enabled: true }, path: '/metrics' }),
    GatewayConfigModule,
    ThrottlerModule.forRoot([
      {
        ttl: gatewayConfig.GATEWAY_RATE_LIMIT_WINDOW_MS,
        limit: gatewayConfig.GATEWAY_RATE_LIMIT_MAX,
      },
    ]),
    HealthModule,
    AuthModule,
    AccountsModule,
    TransfersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    }),
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule {}
