import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '@/common/interceptors/correlation-id.interceptor';

function signAccessToken(userId: string): string {
  const privateKey = Buffer.from(
    process.env['GATEWAY_TEST_JWT_ACCESS_PRIVATE_KEY_BASE64']!,
    'base64',
  ).toString('utf-8');

  return new JwtService().sign(
    { sub: userId, type: 'access' },
    { algorithm: 'RS256', privateKey, expiresIn: '15m' },
  );
}

describe('Gateway (e2e)', () => {
  let app: NestFastifyApplication;
  let fetchMock: jest.Mock;
  let authHeader: { Authorization: string };

  beforeAll(async () => {
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

    authHeader = { Authorization: `Bearer ${signAccessToken('e2e-user-1')}` };
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('GET /health', () => {
    it('returns 200 without forwarding anywhere', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.service).toBe('gateway');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('internal routes are unreachable', () => {
    it('404s on /auth/internal/users/:id — no such route exists on the Gateway', async () => {
      const res = await request(app.getHttpServer()).get('/auth/internal/users/some-id');

      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('404s on /accounts/:id/internal/transfer-debit — no such route exists on the Gateway', async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts/some-id/internal/transfer-debit')
        .send({});

      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/register', () => {
    it('forwards to Auth and relays its response verbatim', async () => {
      fetchMock.mockResolvedValue({
        status: 201,
        json: () => Promise.resolve({ accessToken: 'token', user: { email: 'a@test.com' } }),
      });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'a@test.com', password: 'password123', firstName: 'A', lastName: 'B' });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBe('token');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/auth/register',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('rejects an invalid body before ever calling Auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('protected routes', () => {
    it('rejects POST /accounts with no Authorization header, never calling Accounts', async () => {
      const res = await request(app.getHttpServer()).post('/accounts').send({ currency: 'USD' });

      expect(res.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('forwards POST /accounts with a valid token and relays the response', async () => {
      fetchMock.mockResolvedValue({
        status: 201,
        json: () => Promise.resolve({ id: 'acc-1', currency: 'USD' }),
      });

      const res = await request(app.getHttpServer())
        .post('/accounts')
        .set(authHeader)
        .send({ currency: 'USD' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('acc-1');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3002/accounts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: authHeader.Authorization }),
        }),
      );
    });

    it('forwards POST /transfers with the Idempotency-Key header', async () => {
      fetchMock.mockResolvedValue({
        status: 202,
        json: () => Promise.resolve({ id: 'tr-1', status: 'INITIATED' }),
      });

      const res = await request(app.getHttpServer())
        .post('/transfers')
        .set(authHeader)
        .set('Idempotency-Key', 'idem-1')
        .send({
          fromAccountId: randomUUID(),
          toAccountId: randomUUID(),
          amount: '10.00',
          currency: 'USD',
        });

      expect(res.status).toBe(202);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3003/transfers',
        expect.objectContaining({
          headers: expect.objectContaining({ 'idempotency-key': 'idem-1' }),
        }),
      );
    });
  });
});
