import { Module } from '@nestjs/common';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

import { AuthClientModule } from '@/auth-client/auth-client.module';
import { EmailModule } from '@/email/email.module';

import { TransferEventsConsumer } from './transfer-events.consumer';

@Module({
  imports: [AuthClientModule, EmailModule],
  providers: [
    TransferEventsConsumer,
    makeCounterProvider({
      name: 'notifications_events_consumed_total',
      help: 'Total notification events successfully processed',
      labelNames: ['event_type'],
    }),
    makeCounterProvider({
      name: 'notifications_events_dead_lettered_total',
      help: 'Total notification events permanently failed and dead-lettered',
      labelNames: ['event_type'],
    }),
  ],
})
export class TransferEventsModule {}
