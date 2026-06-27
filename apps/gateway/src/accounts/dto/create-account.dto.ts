import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { Currency } from '@minibank/types';

export class CreateAccountDto {
  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  currency!: Currency;
}
