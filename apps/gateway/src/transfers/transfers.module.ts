import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
