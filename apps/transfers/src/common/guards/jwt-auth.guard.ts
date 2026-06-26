import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';

import { UnauthorizedException } from '@minibank/errors';
import { createLogger } from '@minibank/logger';

import { TRANSFERS_CONFIG, type TransfersConfig } from '@/config/transfers.config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly publicKey: Buffer;
  private readonly logger = createLogger('transfers');

  constructor(
    private readonly jwt: JwtService,
    @Inject(TRANSFERS_CONFIG) config: TransfersConfig,
  ) {
    this.publicKey = Buffer.from(config.TRANSFERS_JWT_ACCESS_PUBLIC_KEY_BASE64, 'base64');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn({ url: request.url }, 'Request rejected: missing access token');
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
    } catch (err) {
      this.logger.warn(
        { url: request.url, err: err instanceof Error ? err.message : String(err) },
        'Request rejected: invalid or expired access token',
      );
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
