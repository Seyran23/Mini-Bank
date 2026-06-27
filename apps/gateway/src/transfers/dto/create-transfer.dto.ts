import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

import { Currency } from '@minibank/types';

export class CreateTransferDto {
  @ApiProperty({ example: '0a3f1d13-e9bf-404d-91e4-15cd6095fb29' })
  @IsUUID()
  fromAccountId!: string;

  @ApiProperty({ example: '103b7802-70f7-454c-8c62-6fad185164b8' })
  @IsUUID()
  toAccountId!: string;

  @ApiProperty({ example: '20.00' })
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  amount!: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiPropertyOptional({ example: 'Rent split' })
  @IsString()
  @IsOptional()
  description?: string;
}
