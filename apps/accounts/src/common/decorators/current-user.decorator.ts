import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { UnauthorizedException } from '@minibank/errors';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();

  if (!request.user) {
    throw new UnauthorizedException();
  }

  return request.user.id;
});
