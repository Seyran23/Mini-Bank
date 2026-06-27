import { UnauthorizedException } from '@minibank/errors';

export function extractAccessToken(authorization: string | undefined): string {
  const [, accessToken] = authorization?.split(' ') ?? [];
  if (!accessToken) {
    throw new UnauthorizedException('Missing access token');
  }
  return accessToken;
}
