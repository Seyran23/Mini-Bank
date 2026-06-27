import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class DepositDto {
  @ApiProperty({ example: '100.00' })
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  amount!: string;

  @ApiPropertyOptional({ example: 'Paycheck deposit' })
  @IsOptional()
  @IsString()
  description?: string;
}
