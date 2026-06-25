import { randomUUID } from 'crypto';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ?? randomUUID();

    request.headers['x-correlation-id'] = correlationId;
    reply.header('X-Correlation-Id', correlationId);

    return next.handle();
  }
}
