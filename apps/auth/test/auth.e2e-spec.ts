import { execSync } from 'node:child_process';
import path from 'node:path';

import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '@/common/interceptors/correlation-id.interceptor';
import { PrismaService } from '@/prisma/prisma.service';

const SERVICE_ROOT = path.resolve(__dirname, '..');

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    execSync('npx prisma db push --skip-generate', {
      cwd: SERVICE_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    );
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new CorrelationIdInterceptor());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  const validRegisterDto = {
    email: 'alice@example.com',
    password: 'Password123!',
    firstName: 'Alice',
    lastName: 'Smith',
  };

  describe('POST /auth/register', () => {
    it('registers a new user and returns 201 with tokens', async () => {
      const res = await request(app.getHttpServer()).post('/auth/register').send(validRegisterDto);

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe('alice@example.com');
    });

    it('returns 409 when the email is already registered', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(validRegisterDto);
      const res = await request(app.getHttpServer()).post('/auth/register').send(validRegisterDto);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'alice@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with valid credentials and returns 200 with tokens', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(validRegisterDto);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(validRegisterDto);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and returns 200', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegisterDto);
      const { refreshToken } = registerRes.body as { refreshToken: string };

      const res = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });

    it('returns 401 for an invalid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'totally-invalid-token' });

      expect(res.status).toBe(401);
    });

    it('returns 401 and revokes the family on token reuse', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegisterDto);
      const { refreshToken } = registerRes.body as { refreshToken: string };

      // First refresh — valid rotation
      await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken });

      // Second refresh with the original (now-revoked) token — reuse detected
      const res = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token and returns 204', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send(validRegisterDto);
      const { refreshToken } = registerRes.body as { refreshToken: string };

      const res = await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken });

      expect(res.status).toBe(204);
    });

    it('returns 204 even for an unknown token (idempotent)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'unknown-token' });

      expect(res.status).toBe(204);
    });
  });
});
