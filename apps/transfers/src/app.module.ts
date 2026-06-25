import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AccountsClientModule } from '@/accounts-client/accounts-client.module';
import { TransfersConfigModule } from '@/config/transfers-config.module';
import { HealthModule } from '@/health/health.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { RabbitMQModule } from '@/rabbitmq/rabbitmq.module';
import { RedisModule } from '@/redis/redis.module';

import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    TransfersConfigModule,
    PrismaModule,
    RabbitMQModule,
    RedisModule,
    AccountsClientModule,
    HealthModule,
    TransfersModule,
    ScheduleModule.forRoot(),
  ],
})
export class AppModule {}
