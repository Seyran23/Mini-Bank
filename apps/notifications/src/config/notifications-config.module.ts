import { Global, Module } from '@nestjs/common';

import { NOTIFICATIONS_CONFIG, notificationsConfig } from './notifications.config';

@Global()
@Module({
  providers: [{ provide: NOTIFICATIONS_CONFIG, useValue: notificationsConfig }],
  exports: [NOTIFICATIONS_CONFIG],
})
export class NotificationsConfigModule {}
