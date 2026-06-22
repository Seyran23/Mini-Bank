import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '@/common/interceptors/correlation-id.interceptor';
import { Currency } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';

const SERVICE_ROOT = path.resolve(__dirname, '..');

function signAccessToken(userId: string): string {
  const privateKey = Buffer.from(
    process.env['ACCOUNTS_JWT_ACCESS_PRIVATE_KEY_BASE64']!,
    'base64',
  ).toString('utf-8');

  return new JwtService().sign(
    { sub: userId, type: 'access' },
    { algorithm: 'RS256', privateKey, expiresIn: '15m' },
  );
}

describe('Accounts (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  const userId = 'e2e-user-1';
  const otherUserId = 'e2e-user-2';
  let authHeader: { Authorization: string };
  let otherAuthHeader: { Authorization: string };

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', {
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

    authHeader = { Authorization: `Bearer ${signAccessToken(userId)}` };
    otherAuthHeader = { Authorization: `Bearer ${signAccessToken(otherUserId)}` };
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.ledgerEntry.deleteMany();
    await prisma.account.deleteMany();
  });

  describe('POST /accounts', () => {
    it('creates an account and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts')
        .set(authHeader)
        .send({ currency: Currency.USD });

      expect(res.status).toBe(201);
      expect(res.body.currency).toBe(Currency.USD);
      expect(res.body.balance).toBe('0.00');
    });

    it('returns 401 without an access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts')
        .send({ currency: Currency.USD });

      expect(res.status).toBe(401);
    });
  });

  describe('account lifecycle', () => {
    let accountId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts')
        .set(authHeader)
        .send({ currency: Currency.USD });

      accountId = res.body.id;
    });

    it('GET /accounts lists the account', async () => {
      const res = await request(app.getHttpServer()).get('/accounts').set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(accountId);
    });

    it('GET /accounts/:id returns the account for its owner', async () => {
      const res = await request(app.getHttpServer()).get(`/accounts/${accountId}`).set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(accountId);
    });

    it('returns 403 when another user accesses the account', async () => {
      const res = await request(app.getHttpServer())
        .get(`/accounts/${accountId}`)
        .set(otherAuthHeader);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('returns 404 for an unknown account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/00000000-0000-0000-0000-000000000000')
        .set(authHeader);

      expect(res.status).toBe(404);
    });

    describe('POST /accounts/:id/deposit', () => {
      it('deposits and returns the updated balance', async () => {
        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/deposit`)
          .set(authHeader)
          .send({ amount: '100', description: 'paycheck' });

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe('100.00');
      });

      it('returns 400 for an invalid amount', async () => {
        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/deposit`)
          .set(authHeader)
          .send({ amount: 'not-a-number' });

        expect(res.status).toBe(400);
      });
    });

    describe('POST /accounts/:id/withdraw', () => {
      beforeEach(async () => {
        await request(app.getHttpServer())
          .post(`/accounts/${accountId}/deposit`)
          .set(authHeader)
          .send({ amount: '100' });
      });

      it('withdraws within balance and returns the updated balance', async () => {
        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/withdraw`)
          .set(authHeader)
          .send({ amount: '40', description: 'rent' });

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe('60.00');
      });

      it('returns 422 when the withdrawal exceeds the balance', async () => {
        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/withdraw`)
          .set(authHeader)
          .send({ amount: '1000' });

        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
      });
    });

    describe('GET /accounts/:id/ledger', () => {
      it('returns the ledger entries for the account', async () => {
        await request(app.getHttpServer())
          .post(`/accounts/${accountId}/deposit`)
          .set(authHeader)
          .send({ amount: '50' });

        const res = await request(app.getHttpServer())
          .get(`/accounts/${accountId}/ledger`)
          .set(authHeader);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].amount).toBe('50.00');
      });
    });

    describe('internal transfer endpoints', () => {
      const internalAuthHeader = {
        'x-internal-api-key': process.env['ACCOUNTS_INTERNAL_API_KEY']!,
      };
      let otherAccountId: string;
      let transferId: string;

      beforeEach(async () => {
        await request(app.getHttpServer())
          .post(`/accounts/${accountId}/deposit`)
          .set(authHeader)
          .send({ amount: '100' });

        const res = await request(app.getHttpServer())
          .post('/accounts')
          .set(otherAuthHeader)
          .send({ currency: Currency.USD });
        otherAccountId = res.body.id;

        transferId = randomUUID();
      });

      it('returns 401 without the internal api key', async () => {
        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/internal/transfer-debit`)
          .send({ transferId, amount: '40' });

        expect(res.status).toBe(401);
      });

      it('returns 401 with the wrong internal api key', async () => {
        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/internal/transfer-debit`)
          .set({ 'x-internal-api-key': 'wrong-key' })
          .send({ transferId, amount: '40' });

        expect(res.status).toBe(401);
      });

      it('debits the source account', async () => {
        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/internal/transfer-debit`)
          .set(internalAuthHeader)
          .send({ transferId, amount: '40' });

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe('60.00');
      });

      it('retrying the same transferId does not debit twice', async () => {
        const body = { transferId, amount: '40' };

        await request(app.getHttpServer())
          .post(`/accounts/${accountId}/internal/transfer-debit`)
          .set(internalAuthHeader)
          .send(body);

        const retry = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/internal/transfer-debit`)
          .set(internalAuthHeader)
          .send(body);

        expect(retry.status).toBe(200);
        expect(retry.body.balance).toBe('60.00');
      });

      it('returns 422 when the debit exceeds the balance', async () => {
        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/internal/transfer-debit`)
          .set(internalAuthHeader)
          .send({ transferId, amount: '1000' });

        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
      });

      it('credits the destination account', async () => {
        const res = await request(app.getHttpServer())
          .post(`/accounts/${otherAccountId}/internal/transfer-credit`)
          .set(internalAuthHeader)
          .send({ transferId, amount: '40' });

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe('40.00');
      });

      it('reverses a debit on the source account', async () => {
        await request(app.getHttpServer())
          .post(`/accounts/${accountId}/internal/transfer-debit`)
          .set(internalAuthHeader)
          .send({ transferId, amount: '40' });

        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/internal/reversal`)
          .set(internalAuthHeader)
          .send({ transferId, amount: '40' });

        expect(res.status).toBe(200);
        expect(res.body.balance).toBe('100.00');
      });

      it('full transfer: debits one account and credits the other', async () => {
        const debitRes = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/internal/transfer-debit`)
          .set(internalAuthHeader)
          .send({ transferId, amount: '40' });

        const creditRes = await request(app.getHttpServer())
          .post(`/accounts/${otherAccountId}/internal/transfer-credit`)
          .set(internalAuthHeader)
          .send({ transferId, amount: '40' });

        expect(debitRes.body.balance).toBe('60.00');
        expect(creditRes.body.balance).toBe('40.00');
      });
    });

    describe('DELETE /accounts/:id', () => {
      it('closes the account', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/accounts/${accountId}`)
          .set(authHeader);

        expect(res.status).toBe(200);
      });

      it('prevents deposits to a closed account', async () => {
        await request(app.getHttpServer()).delete(`/accounts/${accountId}`).set(authHeader);

        const res = await request(app.getHttpServer())
          .post(`/accounts/${accountId}/deposit`)
          .set(authHeader)
          .send({ amount: '10' });

        expect(res.status).toBe(403);
      });
    });
  });
});
