import { UserResponse } from './user.response';

export class AuthTokensResponse {
  accessToken!: string;
  refreshToken!: string;
  deviceId!: string;
  user!: UserResponse;
}
