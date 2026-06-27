import { Global, Module } from '@nestjs/common';

import { GATEWAY_CONFIG, gatewayConfig } from './gateway.config';

@Global()
@Module({
  providers: [{ provide: GATEWAY_CONFIG, useValue: gatewayConfig }],
  exports: [GATEWAY_CONFIG],
})
export class GatewayConfigModule {}
