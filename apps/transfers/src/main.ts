import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { createLogger } from '@minibank/logger';

import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '@/common/interceptors/correlation-id.interceptor';
import { transfersConfig } from '@/config/transfers.config';

import { AppModule } from './app.module';

const logger = createLogger('transfers');

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
    .setTitle('MiniBank — Transfers Service')
    .setDescription('Cross-account transfers orchestrated as a saga')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = parseInt(transfersConfig.TRANSFERS_PORT);
  await app.listen(port, '0.0.0.0');
  logger.info({ port, env: transfersConfig.NODE_ENV }, 'Transfers service started');
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Failed to start Transfers service');
  process.exit(1);
});
