import { createHash } from 'node:crypto';

import { CallHandler, ExecutionContext, Injectable } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, catchError, of, tap, throwError } from 'rxjs';

import {
  AppException,
  ConflictException,
  UnauthorizedException,
  ValidationException,
} from '@minibank/errors';

import { RedisService } from '@/redis/redis.service';

interface CachedResult {
  statusCode: number;
  body: unknown;
  bodyHash: string;
}

const TTL_SECONDS = 86400;

@Injectable()
export class IdempotencyKeyInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const idempotencyKey = request.headers['idempotency-key'];

    if (!request.user) {
      throw new UnauthorizedException();
    }

    if (!idempotencyKey) {
      throw new ValidationException('Missing Idempotency-Key header');
    }

    const redisKey = `idempotency:${request.user.id}:${idempotencyKey}`;
    const bodyHash = this.hashBody(request.body);
    const client = this.redis.getClient();

    const claimed = await client.set(redisKey, 'PENDING', 'EX', TTL_SECONDS, 'NX');

    if (claimed === 'OK') {
      return next.handle().pipe(
        tap((body) => {
          void this.storeResult(redisKey, { statusCode: reply.statusCode, body, bodyHash });
        }),
        catchError((err: unknown) => {
          if (err instanceof AppException) {
            void this.storeResult(redisKey, { statusCode: err.statusCode, body: err, bodyHash });
          }
          return throwError(() => err);
        }),
      );
    }

    const existingRaw = await client.get(redisKey);

    if (!existingRaw || existingRaw === 'PENDING') {
      throw new ConflictException('A request with this Idempotency-Key is already in progress');
    }

    const existing = JSON.parse(existingRaw) as CachedResult;

    if (existing.bodyHash !== bodyHash) {
      throw new ConflictException('Idempotency-Key reuse with a different request body');
    }

    reply.status(existing.statusCode).send(existing.body);
    return of(existing.body);
  }

  private async storeResult(redisKey: string, result: CachedResult): Promise<void> {
    await this.redis.getClient().set(redisKey, JSON.stringify(result), 'EX', TTL_SECONDS);
  }

  private hashBody(body: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(body ?? {}))
      .digest('hex');
  }
}
