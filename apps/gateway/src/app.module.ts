import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AccountsModule } from '@/accounts/accounts.module';
import { AuthModule } from '@/auth/auth.module';
import { GatewayConfigModule } from '@/config/gateway-config.module';
import { gatewayConfig } from '@/config/gateway.config';
import { HealthModule } from '@/health/health.module';
import { TransfersModule } from '@/transfers/transfers.module';

@Module({
  imports: [
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
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
