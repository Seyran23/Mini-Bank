import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total') private readonly counter: Counter<string>,
    @InjectMetric('http_request_duration_seconds') private readonly histogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const { method, url } = request;

    if (url === '/metrics' || url.startsWith('/health')) {
      return next.handle();
    }

    const stopTimer = this.histogram.startTimer({ method, path: url });

    return next.handle().pipe(
      tap({
        next: () => {
          const status = String(reply.statusCode);
          this.counter.inc({ method, path: url, status });
          stopTimer({ status });
        },
        error: () => {
          this.counter.inc({ method, path: url, status: '500' });
          stopTimer({ status: '500' });
        },
      }),
    );
  }
}
