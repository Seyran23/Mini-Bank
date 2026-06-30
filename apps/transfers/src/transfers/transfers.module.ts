import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

import { OutBoxPublisher } from '@/outbox/outbox-publisher';
import { TransferSagaRunner } from '@/saga-runner/transfer-saga-runner';

import { TransfersController } from './transfers.controller';
import { TransfersRepository } from './transfers.repository';
import { TransfersService } from './transfers.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [TransfersController],
  providers: [
    TransfersService,
    TransfersRepository,
    TransferSagaRunner,
    OutBoxPublisher,
    makeCounterProvider({
      name: 'transfers_total',
      help: 'Total transfers by result',
      labelNames: ['result'],
    }),
    makeHistogramProvider({
      name: 'transfers_amount',
      help: 'Distribution of transfer amounts',
      labelNames: ['currency'],
      buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000],
    }),
    makeGaugeProvider({
      name: 'transfers_in_flight',
      help: 'Transfers currently in a non-terminal saga state',
      labelNames: ['state'],
    }),
  ],
})
export class TransfersModule {}
