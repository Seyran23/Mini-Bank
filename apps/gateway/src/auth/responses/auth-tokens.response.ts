import { ApiProperty } from '@nestjs/swagger';

import { UserResponse } from './user.response';

export class AuthTokensResponse {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken!: string;

  @ApiProperty({ example: '0fd1dba9-7e00-4e45-b7f9-9363dc7bdcb8' })
  deviceId!: string;

  @ApiProperty({ type: UserResponse })
  user!: UserResponse;
}
