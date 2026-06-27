import 'reflect-metadata';

import fastifyHelmet from '@fastify/helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { createLogger } from '@minibank/logger';

import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '@/common/interceptors/correlation-id.interceptor';
import { gatewayConfig } from '@/config/gateway.config';

import { AppModule } from './app.module';

const logger = createLogger('gateway');

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  await app.register(fastifyHelmet);

  app.enableCors();

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
    .setTitle('MiniBank — API Gateway')
    .setDescription('Single public entry point: routes to Auth, Accounts, and Transfers')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = parseInt(gatewayConfig.GATEWAY_PORT);
  await app.listen(port, '0.0.0.0');
  logger.info({ port, env: gatewayConfig.NODE_ENV }, 'Gateway service started');
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Failed to start gateway service');
  process.exit(1);
});
