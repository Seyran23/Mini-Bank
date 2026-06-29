import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as amqp from 'amqplib';
import request from 'supertest';

import { AccountSnapshot, AccountsClient } from '@/accounts-client/accounts-client.service';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '@/common/interceptors/correlation-id.interceptor';
import { Currency } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';
import { TransferSagaRunner } from '@/saga-runner/transfer-saga-runner';

const SERVICE_ROOT = path.resolve(__dirname, '..');

function signAccessToken(userId: string): string {
  const privateKey = Buffer.from(
    process.env['TRANSFERS_JWT_ACCESS_PRIVATE_KEY_BASE64']!,
    'base64',
  ).toString('utf-8');

  return new JwtService().sign(
    { sub: userId, type: 'access' },
    { algorithm: 'RS256', privateKey, expiresIn: '15m' },
  );
}

// Best-effort cleanup — purges queues this suite's real saga/outbox runs may
// have published into, so a leftover test event never sits in Notifications'
// queue waiting to be processed against a userId that was never real.
async function purgeDownstreamQueues(): Promise<void> {
  let connection: amqp.ChannelModel | undefined;
  try {
    connection = await amqp.connect(process.env['RABBITMQ_URL']!);
    const channel = await connection.createChannel();
    await channel.purgeQueue('notifications.events.queue').catch(() => undefined);
    await channel.purgeQueue('minibank.events.dlq').catch(() => undefined);
    await channel.close();
  } catch {
    // Non-fatal — if RabbitMQ isn't reachable here, the actual tests above
    // would already have failed for the same reason.
  } finally {
    await connection?.close();
  }
}

describe('Transfers (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let sagaRunner: TransferSagaRunner;
  let accountsClient: jest.Mocked<AccountsClient>;

  const userId = 'e2e-user-1';
  const otherUserId = 'e2e-user-2';
  let authHeader: { Authorization: string };
  let otherAuthHeader: { Authorization: string };

  const sourceAccountId = randomUUID();
  const destinationAccountId = randomUUID();

  function activeAccount(overrides: Partial<AccountSnapshot> = {}): AccountSnapshot {
    return {
      id: sourceAccountId,
      userId,
      currency: Currency.USD,
      status: 'ACTIVE',
      balance: '100.00',
      ...overrides,
    };
  }

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', {
      cwd: SERVICE_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
    });

    const accountsClientMock = {
      getAccount: jest.fn(),
      getAccountInternal: jest.fn(),
      transferDebit: jest.fn(),
      transferCredit: jest.fn(),
      reversal: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AccountsClient)
      .useValue(accountsClientMock)
      .compile();

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
    sagaRunner = app.get(TransferSagaRunner);
    accountsClient = app.get(AccountsClient);

    authHeader = { Authorization: `Bearer ${signAccessToken(userId)}` };
    otherAuthHeader = { Authorization: `Bearer ${signAccessToken(otherUserId)}` };
  }, 30_000);

  afterAll(async () => {
    await app.close();
    // The saga runner/outbox publisher genuinely publish real events to the
    // shared RabbitMQ instance during these tests (e.g. the compensation
    // case below). Without this, those events sit in Notifications' queue
    // indefinitely, referencing a userId ('e2e-user-1') that was never a
    // real Auth user — a poison message Notifications can never resolve.
    await purgeDownstreamQueues();
  });

  beforeEach(async () => {
    await prisma.outBoxEvent.deleteMany();
    await prisma.transfer.deleteMany();
    jest.clearAllMocks();
    accountsClient.getAccount.mockResolvedValue(activeAccount());
    accountsClient.getAccountInternal.mockResolvedValue(
      activeAccount({ id: destinationAccountId }),
    );
  });

  describe('POST /transfers', () => {
    it('returns 401 without an access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/transfers')
        .set('Idempotency-Key', randomUUID())
        .send({
          fromAccountId: sourceAccountId,
          toAccountId: destinationAccountId,
          amount: '40',
          currency: 'USD',
        });

      expect(res.status).toBe(401);
    });

    it('returns 422 without an Idempotency-Key header', async () => {
      const res = await request(app.getHttpServer()).post('/transfers').set(authHeader).send({
        fromAccountId: sourceAccountId,
        toAccountId: destinationAccountId,
        amount: '40',
        currency: 'USD',
      });

      expect(res.status).toBe(422);
    });

    it('creates a transfer and returns 202 INITIATED', async () => {
      const res = await request(app.getHttpServer())
        .post('/transfers')
        .set(authHeader)
        .set('Idempotency-Key', randomUUID())
        .send({
          fromAccountId: sourceAccountId,
          toAccountId: destinationAccountId,
          amount: '40',
          currency: 'USD',
        });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('INITIATED');
      expect(res.body.fromAccountId).toBe(sourceAccountId);
    });

    it('returns 403 when the source account does not belong to the caller', async () => {
      accountsClient.getAccount.mockResolvedValue(activeAccount({ userId: otherUserId }));

      const res = await request(app.getHttpServer())
        .post('/transfers')
        .set(authHeader)
        .set('Idempotency-Key', randomUUID())
        .send({
          fromAccountId: sourceAccountId,
          toAccountId: destinationAccountId,
          amount: '40',
          currency: 'USD',
        });

      expect(res.status).toBe(403);
    });

    it('returns 422 when the destination account currency does not match', async () => {
      accountsClient.getAccountInternal.mockResolvedValue(
        activeAccount({ id: destinationAccountId, currency: Currency.EUR }),
      );

      const res = await request(app.getHttpServer())
        .post('/transfers')
        .set(authHeader)
        .set('Idempotency-Key', randomUUID())
        .send({
          fromAccountId: sourceAccountId,
          toAccountId: destinationAccountId,
          amount: '40',
          currency: 'USD',
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    describe('idempotency', () => {
      it('replays the original response for a retry with the same key and body', async () => {
        const idempotencyKey = randomUUID();
        const body = {
          fromAccountId: sourceAccountId,
          toAccountId: destinationAccountId,
          amount: '40',
          currency: 'USD',
        };

        const first = await request(app.getHttpServer())
          .post('/transfers')
          .set(authHeader)
          .set('Idempotency-Key', idempotencyKey)
          .send(body);

        const second = await request(app.getHttpServer())
          .post('/transfers')
          .set(authHeader)
          .set('Idempotency-Key', idempotencyKey)
          .send(body);

        expect(second.status).toBe(first.status);
        expect(second.body).toEqual(first.body);

        const transfers = await prisma.transfer.findMany();
        expect(transfers).toHaveLength(1);
      });

      it('returns 409 for the same key with a different body', async () => {
        const idempotencyKey = randomUUID();

        await request(app.getHttpServer())
          .post('/transfers')
          .set(authHeader)
          .set('Idempotency-Key', idempotencyKey)
          .send({
            fromAccountId: sourceAccountId,
            toAccountId: destinationAccountId,
            amount: '40',
            currency: 'USD',
          });

        const res = await request(app.getHttpServer())
          .post('/transfers')
          .set(authHeader)
          .set('Idempotency-Key', idempotencyKey)
          .send({
            fromAccountId: sourceAccountId,
            toAccountId: destinationAccountId,
            amount: '99',
            currency: 'USD',
          });

        expect(res.status).toBe(409);
      });
    });
  });

  describe('transfer lifecycle', () => {
    let transferId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/transfers')
        .set(authHeader)
        .set('Idempotency-Key', randomUUID())
        .send({
          fromAccountId: sourceAccountId,
          toAccountId: destinationAccountId,
          amount: '40',
          currency: 'USD',
        });

      transferId = res.body.id;
    });

    it('GET /transfers/:id returns the transfer for its owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/transfers/${transferId}`)
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(transferId);
    });

    it('returns 403 when another user requests it', async () => {
      const res = await request(app.getHttpServer())
        .get(`/transfers/${transferId}`)
        .set(otherAuthHeader);

      expect(res.status).toBe(403);
    });

    it('returns 404 for an unknown transfer', async () => {
      const res = await request(app.getHttpServer())
        .get('/transfers/00000000-0000-0000-0000-000000000000')
        .set(authHeader);

      expect(res.status).toBe(404);
    });

    it('GET /transfers lists the transfer for its owner', async () => {
      const res = await request(app.getHttpServer()).get('/transfers').set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(transferId);
    });

    it('progresses through the saga to COMPLETED as the runner ticks', async () => {
      accountsClient.transferDebit.mockResolvedValue({} as never);
      accountsClient.transferCredit.mockResolvedValue({} as never);

      // INITIATED -> DEBIT_PENDING -> DEBIT_COMPLETE -> CREDIT_PENDING -> COMPLETED
      for (let i = 0; i < 4; i++) {
        await sagaRunner.tick();
      }

      const res = await request(app.getHttpServer())
        .get(`/transfers/${transferId}`)
        .set(authHeader);

      expect(res.body.status).toBe('COMPLETED');
      expect(accountsClient.transferDebit).toHaveBeenCalledTimes(1);
      expect(accountsClient.transferCredit).toHaveBeenCalledTimes(1);

      const outboxEvents = await prisma.outBoxEvent.findMany();
      expect(outboxEvents).toHaveLength(1);
      expect(outboxEvents[0]!.eventType).toBe('transfer.completed');
    });

    it('moves to FAILED with a reason when the debit fails', async () => {
      accountsClient.transferDebit.mockRejectedValue(new Error('insufficient funds'));

      // INITIATED -> DEBIT_PENDING -> FAILED
      await sagaRunner.tick();
      await sagaRunner.tick();

      const res = await request(app.getHttpServer())
        .get(`/transfers/${transferId}`)
        .set(authHeader);

      expect(res.body.status).toBe('FAILED');
      expect(res.body.failureReason).toContain('insufficient funds');
    });

    it('compensates by reversing the debit when the credit fails', async () => {
      accountsClient.transferDebit.mockResolvedValue({} as never);
      accountsClient.transferCredit.mockRejectedValue(new Error('account closed'));
      accountsClient.reversal.mockResolvedValue({} as never);

      // INITIATED -> DEBIT_PENDING -> DEBIT_COMPLETE -> CREDIT_PENDING -> COMPENSATING -> COMPENSATED
      for (let i = 0; i < 5; i++) {
        await sagaRunner.tick();
      }

      const res = await request(app.getHttpServer())
        .get(`/transfers/${transferId}`)
        .set(authHeader);

      expect(res.body.status).toBe('COMPENSATED');
      expect(accountsClient.reversal).toHaveBeenCalledWith(
        sourceAccountId,
        transferId,
        '40',
        'USD',
        expect.any(String),
      );
    });
  });
});
