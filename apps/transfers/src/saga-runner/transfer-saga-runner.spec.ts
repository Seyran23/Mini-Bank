import { Test, TestingModule } from '@nestjs/testing';

import { AccountsClient } from '@/accounts-client/accounts-client.service';
import { Currency, Prisma, SagaState, Transfer } from '@/generated/prisma';
import { TransfersRepository } from '@/transfers/transfers.repository';

import { TransferSagaRunner } from './transfer-saga-runner';

function buildTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: 'transfer-id-1',
    userId: 'user-id-1',
    fromAccountId: 'account-id-1',
    toAccountId: 'account-id-2',
    amount: new Prisma.Decimal('40'),
    currency: Currency.USD,
    sagaState: SagaState.INITIATED,
    failureReason: null,
    correlationId: 'correlation-id-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('TransferSagaRunner', () => {
  let runner: TransferSagaRunner;
  let repo: jest.Mocked<TransfersRepository>;
  let accountsClient: jest.Mocked<AccountsClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferSagaRunner,
        {
          provide: TransfersRepository,
          useValue: {
            findNonTerminalTransfers: jest.fn(),
            claimTransfer: jest.fn(),
            advanceSagaState: jest.fn(),
            advanceSagaStateWithOutboxEvent: jest.fn(),
          },
        },
        {
          provide: AccountsClient,
          useValue: {
            transferDebit: jest.fn(),
            transferCredit: jest.fn(),
            reversal: jest.fn(),
          },
        },
      ],
    }).compile();

    runner = module.get(TransferSagaRunner);
    repo = module.get(TransfersRepository);
    accountsClient = module.get(AccountsClient);
  });

  afterEach(() => jest.clearAllMocks());

  describe('INITIATED', () => {
    it('claims the transfer to DEBIT_PENDING', async () => {
      const transfer = buildTransfer({ sagaState: SagaState.INITIATED });
      repo.findNonTerminalTransfers.mockResolvedValue([transfer]);

      await runner.tick();

      expect(repo.claimTransfer).toHaveBeenCalledWith(
        transfer.id,
        SagaState.INITIATED,
        SagaState.DEBIT_PENDING,
      );
      expect(accountsClient.transferDebit).not.toHaveBeenCalled();
    });
  });

  describe('DEBIT_PENDING', () => {
    it('debits the source account and advances to DEBIT_COMPLETE on success', async () => {
      const transfer = buildTransfer({ sagaState: SagaState.DEBIT_PENDING });
      repo.findNonTerminalTransfers.mockResolvedValue([transfer]);
      accountsClient.transferDebit.mockResolvedValue({} as never);

      await runner.tick();

      expect(accountsClient.transferDebit).toHaveBeenCalledWith(
        transfer.fromAccountId,
        transfer.id,
        '40',
        transfer.currency,
        transfer.correlationId,
      );
      expect(repo.claimTransfer).toHaveBeenCalledWith(
        transfer.id,
        SagaState.DEBIT_PENDING,
        SagaState.DEBIT_COMPLETE,
      );
    });

    it('advances to FAILED with an outbox event when the debit fails', async () => {
      const transfer = buildTransfer({ sagaState: SagaState.DEBIT_PENDING });
      repo.findNonTerminalTransfers.mockResolvedValue([transfer]);
      accountsClient.transferDebit.mockRejectedValue(new Error('insufficient funds'));

      await runner.tick();

      expect(repo.claimTransfer).not.toHaveBeenCalled();
      expect(repo.advanceSagaStateWithOutboxEvent).toHaveBeenCalledTimes(1);
      const [transferId, sagaState, outboxEvent, failureReason] =
        repo.advanceSagaStateWithOutboxEvent.mock.calls[0]!;
      expect(transferId).toBe(transfer.id);
      expect(sagaState).toBe(SagaState.FAILED);
      expect(outboxEvent.eventType).toBe('transfer.failed');
      expect((outboxEvent.payload as { payload: { reason: string } }).payload.reason).toBe(
        'insufficient funds',
      );
      expect(failureReason).toBe('insufficient funds');
    });
  });

  describe('DEBIT_COMPLETE', () => {
    it('claims the transfer to CREDIT_PENDING', async () => {
      const transfer = buildTransfer({ sagaState: SagaState.DEBIT_COMPLETE });
      repo.findNonTerminalTransfers.mockResolvedValue([transfer]);

      await runner.tick();

      expect(repo.claimTransfer).toHaveBeenCalledWith(
        transfer.id,
        SagaState.DEBIT_COMPLETE,
        SagaState.CREDIT_PENDING,
      );
      expect(accountsClient.transferCredit).not.toHaveBeenCalled();
    });
  });

  describe('CREDIT_PENDING', () => {
    it('credits the destination account and advances to COMPLETED on success', async () => {
      const transfer = buildTransfer({ sagaState: SagaState.CREDIT_PENDING });
      repo.findNonTerminalTransfers.mockResolvedValue([transfer]);
      accountsClient.transferCredit.mockResolvedValue({} as never);

      await runner.tick();

      expect(accountsClient.transferCredit).toHaveBeenCalledWith(
        transfer.toAccountId,
        transfer.id,
        '40',
        transfer.currency,
        transfer.correlationId,
      );
      expect(repo.advanceSagaStateWithOutboxEvent).toHaveBeenCalledTimes(1);
      const [transferId, sagaState, outboxEvent] =
        repo.advanceSagaStateWithOutboxEvent.mock.calls[0]!;
      expect(transferId).toBe(transfer.id);
      expect(sagaState).toBe(SagaState.COMPLETED);
      expect(outboxEvent.eventType).toBe('transfer.completed');
    });

    it('advances to COMPENSATING (no outbox event) when the credit fails', async () => {
      const transfer = buildTransfer({ sagaState: SagaState.CREDIT_PENDING });
      repo.findNonTerminalTransfers.mockResolvedValue([transfer]);
      accountsClient.transferCredit.mockRejectedValue(new Error('account closed'));

      await runner.tick();

      expect(repo.advanceSagaStateWithOutboxEvent).not.toHaveBeenCalled();
      expect(repo.advanceSagaState).toHaveBeenCalledWith(
        transfer.id,
        SagaState.COMPENSATING,
        'account closed',
      );
    });
  });

  describe('COMPENSATING', () => {
    it('reverses the debit and advances to COMPENSATED on success', async () => {
      const transfer = buildTransfer({ sagaState: SagaState.COMPENSATING });
      repo.findNonTerminalTransfers.mockResolvedValue([transfer]);
      accountsClient.reversal.mockResolvedValue({} as never);

      await runner.tick();

      expect(accountsClient.reversal).toHaveBeenCalledWith(
        transfer.fromAccountId,
        transfer.id,
        '40',
        transfer.currency,
        transfer.correlationId,
      );
      expect(repo.advanceSagaStateWithOutboxEvent).toHaveBeenCalledTimes(1);
      const [transferId, sagaState, outboxEvent] =
        repo.advanceSagaStateWithOutboxEvent.mock.calls[0]!;
      expect(transferId).toBe(transfer.id);
      expect(sagaState).toBe(SagaState.COMPENSATED);
      expect(outboxEvent.eventType).toBe('transfer.failed');
    });

    it('retries indefinitely (no state change) when the reversal keeps failing', async () => {
      const transfer = buildTransfer({ sagaState: SagaState.COMPENSATING });
      repo.findNonTerminalTransfers.mockResolvedValue([transfer]);
      accountsClient.reversal.mockRejectedValue(new Error('Accounts is down'));

      await runner.tick();
      await runner.tick();

      expect(accountsClient.reversal).toHaveBeenCalledTimes(2);
      expect(repo.advanceSagaState).not.toHaveBeenCalled();
      expect(repo.advanceSagaStateWithOutboxEvent).not.toHaveBeenCalled();
    });
  });

  describe('tick resilience', () => {
    it('keeps processing remaining transfers when one fails unexpectedly', async () => {
      const failing = buildTransfer({ id: 'transfer-id-failing', sagaState: SagaState.INITIATED });
      const healthy = buildTransfer({ id: 'transfer-id-healthy', sagaState: SagaState.INITIATED });
      repo.findNonTerminalTransfers.mockResolvedValue([failing, healthy]);
      repo.claimTransfer
        .mockRejectedValueOnce(new Error('unexpected db error'))
        .mockResolvedValueOnce(true);

      await runner.tick();

      expect(repo.claimTransfer).toHaveBeenCalledTimes(2);
      expect(repo.claimTransfer).toHaveBeenNthCalledWith(
        2,
        healthy.id,
        SagaState.INITIATED,
        SagaState.DEBIT_PENDING,
      );
    });
  });
});
