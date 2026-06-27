import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

import { AppException } from '@minibank/errors';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
}

type NestHttpResponse = { message: string | string[]; error?: string };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const body = this.toErrorBody(exception, request.url);

    if (body.statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    reply.status(body.statusCode).send(body);
  }

  private toErrorBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof AppException) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        path,
        timestamp,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : Array.isArray((res as NestHttpResponse).message)
            ? ((res as NestHttpResponse).message as string[]).join(', ')
            : String((res as NestHttpResponse).message);

      return { statusCode: status, code: 'HTTP_ERROR', message, path, timestamp };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      path,
      timestamp,
    };
  }
}
