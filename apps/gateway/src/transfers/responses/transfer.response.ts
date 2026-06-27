import { ApiProperty } from '@nestjs/swagger';

import { Currency, SagaState } from '@minibank/types';

export class TransferResponse {
  @ApiProperty({ example: '81744e27-fb05-4696-8ff4-b19d79553b47' })
  id!: string;

  @ApiProperty({ example: '0a3f1d13-e9bf-404d-91e4-15cd6095fb29' })
  fromAccountId!: string;

  @ApiProperty({ example: '103b7802-70f7-454c-8c62-6fad185164b8' })
  toAccountId!: string;

  @ApiProperty({ example: '20.00' })
  amount!: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  currency!: Currency;

  @ApiProperty({ enum: SagaState, example: SagaState.COMPLETED })
  status!: SagaState;

  @ApiProperty({ example: 'Insufficient funds', nullable: true })
  failureReason!: string | null;

  @ApiProperty({ example: '2026-06-26T13:55:36.505Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-06-26T13:55:54.734Z' })
  updatedAt!: string;
}
