import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';

import { UnauthorizedException } from '@minibank/errors';

import { ACCOUNTS_CONFIG, type AccountsConfig } from '@/config/accounts.config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly publicKey: Buffer;

  constructor(
    private readonly jwt: JwtService,
    @Inject(ACCOUNTS_CONFIG) config: AccountsConfig,
  ) {
    this.publicKey = Buffer.from(config.ACCOUNTS_JWT_ACCESS_PUBLIC_KEY_BASE64, 'base64');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(
        authHeader.slice(7),
        { publicKey: this.publicKey, algorithms: ['RS256'] },
      );

      if (payload.type !== 'access') {
        throw new Error('wrong token type');
      }

      request.user = { id: payload.sub };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
