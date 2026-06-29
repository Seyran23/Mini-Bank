import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

import { Currency } from '@/generated/prisma';

export class InternalTransferDto {
  @IsUUID()
  transferId!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsOptional()
  @IsString()
  description?: string;
}
