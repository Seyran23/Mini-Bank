import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

import { AccountsModule } from '@/accounts/accounts.module';
import { MetricsInterceptor } from '@/common/interceptors/metrics.interceptor';
import { HealthModule } from '@/health/health.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [
    PrometheusModule.register({ defaultMetrics: { enabled: true }, path: '/metrics' }),
    PrismaModule,
    AccountsModule,
    HealthModule,
  ],
  providers: [
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
