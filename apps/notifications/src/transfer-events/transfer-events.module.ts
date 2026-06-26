import { Module } from '@nestjs/common';

import { AuthClientModule } from '@/auth-client/auth-client.module';
import { EmailModule } from '@/email/email.module';

import { TransferEventsConsumer } from './transfer-events.consumer';

@Module({
  imports: [AuthClientModule, EmailModule],
  providers: [TransferEventsConsumer],
})
export class TransferEventsModule {}
