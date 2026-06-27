import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
