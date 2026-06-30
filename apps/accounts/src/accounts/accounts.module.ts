import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

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
    makeCounterProvider({
      name: 'accounts_deposits_total',
      help: 'Total successful deposits',
      labelNames: ['currency'],
    }),
    makeCounterProvider({
      name: 'accounts_withdrawals_total',
      help: 'Total successful withdrawals',
      labelNames: ['currency'],
    }),
  ],
})
export class AccountsModule {}
