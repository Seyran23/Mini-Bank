import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

import { AuthClientModule } from '@/auth-client/auth-client.module';
import { MetricsInterceptor } from '@/common/interceptors/metrics.interceptor';
import { NotificationsConfigModule } from '@/config/notifications-config.module';
import { EmailModule } from '@/email/email.module';
import { HealthModule } from '@/health/health.module';
import { RabbitMQModule } from '@/rabbitmq/rabbitmq.module';
import { RedisModule } from '@/redis/redis.module';
import { TransferEventsModule } from '@/transfer-events/transfer-events.module';

@Module({
  imports: [
    PrometheusModule.register({ defaultMetrics: { enabled: true }, path: '/metrics' }),
    NotificationsConfigModule,
    RabbitMQModule,
    RedisModule,
    EmailModule,
    AuthClientModule,
    TransferEventsModule,
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
