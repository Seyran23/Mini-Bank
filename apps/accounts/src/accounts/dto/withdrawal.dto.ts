import { IsOptional, IsString, Matches } from 'class-validator';

export class WithdrawalDto {
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  amount!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
