import { execSync } from 'node:child_process';
import path from 'node:path';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { Currency, Prisma, SagaState } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';

import { TransfersRepository } from './transfers.repository';

const SERVICE_ROOT = path.resolve(__dirname, '../..');

describe('TransfersRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let repo: TransfersRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    process.env['TRANSFERS_DATABASE_URL'] = container.getConnectionUri();

    execSync('npx prisma migrate deploy', {
      cwd: SERVICE_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
    });

    prisma = new PrismaService();
    await prisma.onModuleInit();
    repo = new TransfersRepository(prisma);
  }, 60_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await container.stop();
  });

  beforeEach(async () => {
    await prisma.outBoxEvent.deleteMany();
    await prisma.transfer.deleteMany();
  });

  const userId = 'user-id-1';

  function createData() {
    return {
      userId,
      fromAccountId: 'account-id-1',
      toAccountId: 'account-id-2',
      amount: new Prisma.Decimal('40'),
      currency: Currency.USD,
      correlationId: 'correlation-id-1',
    };
  }

  describe('createTransfer / findTransferById / findTransfersByUserId', () => {
    it('creates a transfer defaulting to INITIATED', async () => {
      const transfer = await repo.createTransfer(createData());

      expect(transfer.sagaState).toBe(SagaState.INITIATED);
      expect(transfer.amount.toString()).toBe('40');
    });

    it('finds a transfer by id', async () => {
      const created = await repo.createTransfer(createData());

      const found = await repo.findTransferById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('returns null for a non-existent id', async () => {
      const found = await repo.findTransferById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });

    it('returns all transfers for a user', async () => {
      await repo.createTransfer(createData());
      await repo.createTransfer(createData());
      await repo.createTransfer({ ...createData(), userId: 'user-id-2' });

      const transfers = await repo.findTransfersByUserId(userId);

      expect(transfers).toHaveLength(2);
    });
  });

  describe('findNonTerminalTransfers', () => {
    it('returns transfers in non-terminal states only', async () => {
      const initiated = await repo.createTransfer(createData());
      const completed = await repo.createTransfer(createData());
      await repo.advanceSagaStateWithOutboxEvent(completed.id, SagaState.COMPLETED, {
        eventType: 'transfer.completed',
        payload: { foo: 'bar' },
      });

      const nonTerminal = await repo.findNonTerminalTransfers();

      expect(nonTerminal.map((t) => t.id)).toEqual([initiated.id]);
    });
  });

  describe('claimTransfer', () => {
    it('claims when the row is still in fromState', async () => {
      const transfer = await repo.createTransfer(createData());

      const claimed = await repo.claimTransfer(
        transfer.id,
        SagaState.INITIATED,
        SagaState.DEBIT_PENDING,
      );

      expect(claimed).toBe(true);
      const updated = await repo.findTransferById(transfer.id);
      expect(updated!.sagaState).toBe(SagaState.DEBIT_PENDING);
    });

    it('does not claim when the row is no longer in fromState', async () => {
      const transfer = await repo.createTransfer(createData());
      await repo.claimTransfer(transfer.id, SagaState.INITIATED, SagaState.DEBIT_PENDING);

      const claimedAgain = await repo.claimTransfer(
        transfer.id,
        SagaState.INITIATED,
        SagaState.DEBIT_PENDING,
      );

      expect(claimedAgain).toBe(false);
    });

    it('serializes concurrent claims so only one caller wins', async () => {
      const transfer = await repo.createTransfer(createData());

      const results = await Promise.all([
        repo.claimTransfer(transfer.id, SagaState.INITIATED, SagaState.DEBIT_PENDING),
        repo.claimTransfer(transfer.id, SagaState.INITIATED, SagaState.DEBIT_PENDING),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });

  describe('advanceSagaState', () => {
    it('updates the sagaState and failureReason without writing an outbox event', async () => {
      const transfer = await repo.createTransfer(createData());

      await repo.advanceSagaState(transfer.id, SagaState.COMPENSATING, 'credit failed');

      const updated = await repo.findTransferById(transfer.id);
      expect(updated!.sagaState).toBe(SagaState.COMPENSATING);
      expect(updated!.failureReason).toBe('credit failed');

      const outboxEvents = await prisma.outBoxEvent.findMany();
      expect(outboxEvents).toHaveLength(0);
    });
  });

  describe('advanceSagaStateWithOutboxEvent', () => {
    it('updates the sagaState and writes an outbox event atomically', async () => {
      const transfer = await repo.createTransfer(createData());

      await repo.advanceSagaStateWithOutboxEvent(transfer.id, SagaState.COMPLETED, {
        eventType: 'transfer.completed',
        payload: { transferId: transfer.id },
      });

      const updated = await repo.findTransferById(transfer.id);
      expect(updated!.sagaState).toBe(SagaState.COMPLETED);

      const outboxEvents = await repo.findUnpublishedOutboxEvents();
      expect(outboxEvents).toHaveLength(1);
      expect(outboxEvents[0]!.eventType).toBe('transfer.completed');
    });

    it('rolls back the sagaState change if the outbox insert fails', async () => {
      const transfer = await repo.createTransfer(createData());

      await expect(
        repo.advanceSagaStateWithOutboxEvent(transfer.id, SagaState.COMPLETED, {
          eventType: 'transfer.completed',
          // @ts-expect-error - intentionally invalid payload to force the transaction to fail
          payload: undefined,
        }),
      ).rejects.toThrow();

      const updated = await repo.findTransferById(transfer.id);
      expect(updated!.sagaState).toBe(SagaState.INITIATED);
    });
  });

  describe('findUnpublishedOutboxEvents / markOutboxEventPublished', () => {
    it('only returns events that have not been published yet', async () => {
      const transfer = await repo.createTransfer(createData());
      await repo.advanceSagaStateWithOutboxEvent(transfer.id, SagaState.COMPLETED, {
        eventType: 'transfer.completed',
        payload: { transferId: transfer.id },
      });

      const [event] = await repo.findUnpublishedOutboxEvents();
      await repo.markOutboxEventPublished(event!.id);

      const stillUnpublished = await repo.findUnpublishedOutboxEvents();
      expect(stillUnpublished).toHaveLength(0);
    });
  });
});
