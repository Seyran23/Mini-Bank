import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class WithdrawalDto {
  @ApiProperty({ example: '20.00' })
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  amount!: string;

  @ApiPropertyOptional({ example: 'ATM withdrawal' })
  @IsOptional()
  @IsString()
  description?: string;
}
