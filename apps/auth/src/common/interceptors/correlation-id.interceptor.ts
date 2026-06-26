import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { createLogger } from '@minibank/logger';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = createLogger('auth');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const correlationId = (request.headers['x-correlation-id'] as string | undefined) ?? uuidv4();

    request.headers['x-correlation-id'] = correlationId;
    reply.header('X-Correlation-Id', correlationId);

    const start = Date.now();
    const { method, url } = request;
    const isNoisyEndpoint = url.startsWith('/health') || url.startsWith('/docs');

    return next.handle().pipe(
      tap({
        next: () => {
          if (isNoisyEndpoint) {
            return;
          }
          this.logger.info(
            {
              correlationId,
              method,
              url,
              statusCode: reply.statusCode,
              durationMs: Date.now() - start,
            },
            'Request completed',
          );
        },
        error: (err: unknown) => {
          this.logger.warn(
            {
              correlationId,
              method,
              url,
              durationMs: Date.now() - start,
              err: err instanceof Error ? err.message : String(err),
            },
            'Request failed',
          );
        },
      }),
    );
  }
}
