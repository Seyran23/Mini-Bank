import { Global, Module } from '@nestjs/common';

import { AccountsClient } from './accounts-client.service';

@Global()
@Module({
  providers: [AccountsClient],
  exports: [AccountsClient],
})
export class AccountsClientModule {}
