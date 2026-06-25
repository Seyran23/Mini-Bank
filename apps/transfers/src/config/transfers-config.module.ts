import { Global, Module } from '@nestjs/common';

import { TRANSFERS_CONFIG, transfersConfig } from './transfers.config';

@Global()
@Module({
  providers: [{ provide: TRANSFERS_CONFIG, useValue: transfersConfig }],
  exports: [TRANSFERS_CONFIG],
})
export class TransfersConfigModule {}
