import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@minibank/types';

export class AccountResponse {
  @ApiProperty({ example: '3a4413b0-c535-43fa-ab6d-618a166482bc' })
  id!: string;

  @ApiProperty({ example: '58bde370-97a1-47bd-8b92-d9496a72028f' })
  userId!: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  currency!: Currency;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: '100.00' })
  balance!: string;

  @ApiProperty({ example: '2026-06-26T13:55:12.371Z' })
  createdAt!: string;
}
