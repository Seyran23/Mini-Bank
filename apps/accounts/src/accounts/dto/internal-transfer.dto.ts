import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class InternalTransferDto {
  @IsUUID()
  transferId!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  amount!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
