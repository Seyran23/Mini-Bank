import { ApiProperty } from '@nestjs/swagger';

export class UserResponse {
  @ApiProperty({ example: '58bde370-97a1-47bd-8b92-d9496a72028f' })
  id!: string;

  @ApiProperty({ example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ example: 'Alice' })
  firstName!: string;

  @ApiProperty({ example: 'Anderson' })
  lastName!: string;

  @ApiProperty({ example: '2026-06-26T13:55:12.316Z' })
  createdAt!: string;
}
