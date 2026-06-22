import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ACCOUNTS_CONFIG, accountsConfig } from '@/config/accounts.config';

import { AccountsController } from './accounts.controller';
import { AccountsRepository } from './accounts.repository';
import { AccountsService } from './accounts.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AccountsController],
  providers: [
    AccountsService,
    AccountsRepository,
    { provide: ACCOUNTS_CONFIG, useValue: accountsConfig },
  ],
})
export class AccountsModule {}
