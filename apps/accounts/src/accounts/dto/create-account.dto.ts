import { IsEnum } from 'class-validator';

import { Currency } from '@/generated/prisma';

export class CreateAccountDto {
  @IsEnum(Currency)
  currency!: Currency;
}
