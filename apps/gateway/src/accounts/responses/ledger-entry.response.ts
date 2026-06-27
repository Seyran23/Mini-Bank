import { ApiProperty } from '@nestjs/swagger';

export class LedgerEntryResponse {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7' })
  id!: string;

  @ApiProperty({ example: 'DEPOSIT' })
  type!: string;

  @ApiProperty({ example: '100.00' })
  amount!: string;

  @ApiProperty({ example: 'Paycheck deposit', nullable: true })
  description!: string | null;

  @ApiProperty({ example: '2026-06-26T13:55:12.371Z' })
  createdAt!: string;
}
