import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

import { Currency } from '@/generated/prisma';

export class CreateTransferDto {
  @IsUUID()
  fromAccountId!: string;

  @IsUUID()
  toAccountId!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsString()
  @IsOptional()
  description?: string;
}
