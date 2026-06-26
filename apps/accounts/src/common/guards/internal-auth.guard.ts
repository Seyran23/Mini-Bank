import crypto from 'crypto';

import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { UnauthorizedException } from '@minibank/errors';
import { createLogger } from '@minibank/logger';

import { ACCOUNTS_CONFIG, type AccountsConfig } from '@/config/accounts.config';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly internalApiKey: string;
  private readonly logger = createLogger('accounts');

  constructor(@Inject(ACCOUNTS_CONFIG) config: AccountsConfig) {
    this.internalApiKey = config.ACCOUNTS_INTERNAL_API_KEY;
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const internalApiKeyFromHeader = request.headers['x-internal-api-key'];

    if (typeof internalApiKeyFromHeader !== 'string') {
      this.logger.warn({ url: request.url }, 'Internal call rejected: missing api key header');
      throw new UnauthorizedException('Missing or invalid internal api key');
    }

    const keyLength = Buffer.byteLength(this.internalApiKey);
    const keyFromHeaderLength = Buffer.byteLength(internalApiKeyFromHeader);

    if (keyLength !== keyFromHeaderLength) {
      this.logger.warn({ url: request.url }, 'Internal call rejected: api key length mismatch');
      throw new UnauthorizedException('Missing or invalid internal api key');
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(this.internalApiKey),
      Buffer.from(internalApiKeyFromHeader),
    );

    if (!isValid) {
      this.logger.warn({ url: request.url }, 'Internal call rejected: api key mismatch');
      throw new UnauthorizedException('Missing or invalid internal api key');
    }

    return true;
  }
}
