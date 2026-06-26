import { Module } from '@nestjs/common';

import { AuthClientModule } from '@/auth-client/auth-client.module';
import { NotificationsConfigModule } from '@/config/notifications-config.module';
import { EmailModule } from '@/email/email.module';
import { HealthModule } from '@/health/health.module';
import { RabbitMQModule } from '@/rabbitmq/rabbitmq.module';
import { RedisModule } from '@/redis/redis.module';
import { TransferEventsModule } from '@/transfer-events/transfer-events.module';

@Module({
  imports: [
    NotificationsConfigModule,
    RabbitMQModule,
    RedisModule,
    EmailModule,
    AuthClientModule,
    TransferEventsModule,
    HealthModule,
  ],
})
export class AppModule {}
