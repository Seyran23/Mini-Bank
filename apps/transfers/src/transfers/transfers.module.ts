import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { OutBoxPublisher } from '@/outbox/outbox-publisher';
import { TransferSagaRunner } from '@/saga-runner/transfer-saga-runner';

import { TransfersController } from './transfers.controller';
import { TransfersRepository } from './transfers.repository';
import { TransfersService } from './transfers.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [TransfersController],
  providers: [TransfersService, TransfersRepository, TransferSagaRunner, OutBoxPublisher],
})
export class TransfersModule {}
