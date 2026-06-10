import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { createLogger } from '@minibank/logger';

import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '@/common/interceptors/correlation-id.interceptor';
import { authConfig } from '@/config/auth.config';

const logger = createLogger('auth');

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor());

  const swagger = new DocumentBuilder()
    .setTitle('MiniBank — Auth Service')
    .setDescription('User registration, login, token refresh, and logout')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = parseInt(authConfig.AUTH_PORT);
  await app.listen(port, '0.0.0.0');
  logger.info({ port, env: authConfig.NODE_ENV }, 'Auth service started');
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Failed to start auth service');
  process.exit(1);
});
