import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

import { AccountsClientModule } from '@/accounts-client/accounts-client.module';
import { MetricsInterceptor } from '@/common/interceptors/metrics.interceptor';
import { TransfersConfigModule } from '@/config/transfers-config.module';
import { HealthModule } from '@/health/health.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { RabbitMQModule } from '@/rabbitmq/rabbitmq.module';
import { RedisModule } from '@/redis/redis.module';

import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    PrometheusModule.register({ defaultMetrics: { enabled: true }, path: '/metrics' }),
    TransfersConfigModule,
    PrismaModule,
    RabbitMQModule,
    RedisModule,
    AccountsClientModule,
    HealthModule,
    TransfersModule,
    ScheduleModule.forRoot(),
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
