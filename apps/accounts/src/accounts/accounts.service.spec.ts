import { Test, TestingModule } from '@nestjs/testing';

import {
  ForbiddenException,
  InsufficientFundsException,
  NotFoundException,
  ValidationException,
} from '@minibank/errors';

import { AccountsRepository } from '@/accounts/accounts.repository';
import { AccountsService } from '@/accounts/accounts.service';
import {
  Account,
  AccountStatus,
  Currency,
  LedgerEntry,
  LedgerEntryType,
  Prisma,
} from '@/generated/prisma';

const mockAccount: Account = {
  id: 'account-id-1',
  userId: 'user-id-1',
  currency: Currency.USD,
  status: AccountStatus.ACTIVE,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const closedAccount: Account = { ...mockAccount, status: AccountStatus.CLOSED };

const otherUsersAccount: Account = { ...mockAccount, id: 'account-id-2', userId: 'user-id-2' };

const mockLedgerEntry: LedgerEntry = {
  id: 'entry-id-1',
  accountId: mockAccount.id,
  amount: new Prisma.Decimal('100'),
  type: LedgerEntryType.DEPOSIT,
  relatedTransactionId: null,
  description: 'Initial deposit',
  createdAt: new Date('2024-01-01'),
};

describe('AccountsService', () => {
  let service: AccountsService;
  let repo: jest.Mocked<AccountsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: AccountsRepository,
          useValue: {
            createAccount: jest.fn(),
            findAccountById: jest.fn(),
            findAccountsByUserId: jest.fn(),
            updateAccountStatus: jest.fn(),
            getBalance: jest.fn(),
            computeBalance: jest.fn(),
            createLedgerEntry: jest.fn(),
            findLedgerEntries: jest.fn(),
            findLedgerEntryByRelatedTransaction: jest.fn(),
            withAccountLock: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AccountsService);
    repo = module.get(AccountsRepository);

    repo.withAccountLock.mockImplementation((_accountId, fn) =>
      fn({} as unknown as Prisma.TransactionClient),
    );
    repo.findLedgerEntryByRelatedTransaction.mockResolvedValue(null);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createAccount', () => {
    it('creates an account and returns it with a zero balance', async () => {
      repo.createAccount.mockResolvedValue(mockAccount);

      const result = await service.createAccount('user-id-1', Currency.USD);

      expect(repo.createAccount).toHaveBeenCalledWith('user-id-1', Currency.USD);
      expect(result.id).toBe(mockAccount.id);
      expect(result.balance).toBe('0.00');
    });
  });

  describe('getAccount', () => {
    it('returns the account with its balance for the owner', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.getBalance.mockResolvedValue(new Prisma.Decimal('150.5'));

      const result = await service.getAccount('user-id-1', mockAccount.id);

      expect(result.balance).toBe('150.50');
    });

    it('throws NotFoundException when the account does not exist', async () => {
      repo.findAccountById.mockResolvedValue(null);

      await expect(service.getAccount('user-id-1', 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when accessed by a non-owner', async () => {
      repo.findAccountById.mockResolvedValue(otherUsersAccount);

      await expect(service.getAccount('user-id-1', otherUsersAccount.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('internalGetAccount', () => {
    it('returns the account with its balance regardless of ownership', async () => {
      repo.findAccountById.mockResolvedValue(otherUsersAccount);
      repo.getBalance.mockResolvedValue(new Prisma.Decimal('75'));

      const result = await service.internalGetAccount(otherUsersAccount.id);

      expect(result.userId).toBe(otherUsersAccount.userId);
      expect(result.balance).toBe('75.00');
    });

    it('throws NotFoundException when the account does not exist', async () => {
      repo.findAccountById.mockResolvedValue(null);

      await expect(service.internalGetAccount('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listAccounts', () => {
    it('returns all accounts for a user with their balances', async () => {
      repo.findAccountsByUserId.mockResolvedValue([mockAccount]);
      repo.getBalance.mockResolvedValue(new Prisma.Decimal('25'));

      const result = await service.listAccounts('user-id-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.balance).toBe('25.00');
    });
  });

  describe('closeAccount', () => {
    it('closes an owned account', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.updateAccountStatus.mockResolvedValue(closedAccount);

      const result = await service.closeAccount('user-id-1', mockAccount.id);

      expect(repo.updateAccountStatus).toHaveBeenCalledWith(mockAccount.id, AccountStatus.CLOSED);
      expect(result).toBe('Account is closed successfully!');
    });

    it('throws ForbiddenException when closing another user’s account', async () => {
      repo.findAccountById.mockResolvedValue(otherUsersAccount);

      await expect(service.closeAccount('user-id-1', otherUsersAccount.id)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.updateAccountStatus).not.toHaveBeenCalled();
    });
  });

  describe('deposit', () => {
    it('creates a DEPOSIT ledger entry and returns the updated balance', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.computeBalance.mockResolvedValue(new Prisma.Decimal('100'));

      const result = await service.deposit(
        'user-id-1',
        mockAccount.id,
        new Prisma.Decimal('50'),
        'salary',
      );

      const [, entry] = repo.createLedgerEntry.mock.calls[0]!;
      expect(entry.accountId).toBe(mockAccount.id);
      expect(entry.amount.toString()).toBe('50');
      expect(entry.type).toBe(LedgerEntryType.DEPOSIT);
      expect(entry.description).toBe('salary');
      expect(result.balance).toBe('100.00');
    });

    it('throws ValidationException for a non-positive amount', async () => {
      await expect(
        service.deposit('user-id-1', mockAccount.id, new Prisma.Decimal('0')),
      ).rejects.toThrow(ValidationException);

      expect(repo.findAccountById).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the account does not exist', async () => {
      repo.findAccountById.mockResolvedValue(null);

      await expect(
        service.deposit('user-id-1', 'missing-id', new Prisma.Decimal('10')),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when depositing into another user’s account', async () => {
      repo.findAccountById.mockResolvedValue(otherUsersAccount);

      await expect(
        service.deposit('user-id-1', otherUsersAccount.id, new Prisma.Decimal('10')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when depositing into a closed account', async () => {
      repo.findAccountById.mockResolvedValue(closedAccount);

      await expect(
        service.deposit('user-id-1', closedAccount.id, new Prisma.Decimal('10')),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('withdraw', () => {
    it('creates a WITHDRAWAL ledger entry with a negated amount', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.computeBalance
        .mockResolvedValueOnce(new Prisma.Decimal('100'))
        .mockResolvedValueOnce(new Prisma.Decimal('60'));

      const result = await service.withdraw(
        'user-id-1',
        mockAccount.id,
        new Prisma.Decimal('40'),
        'rent',
      );

      const [, entry] = repo.createLedgerEntry.mock.calls[0]!;
      expect(entry.amount.toString()).toBe('-40');
      expect(entry.type).toBe(LedgerEntryType.WITHDRAWAL);
      expect(result.balance).toBe('60.00');
    });

    it('throws InsufficientFundsException when the balance is too low', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.computeBalance.mockResolvedValue(new Prisma.Decimal('30'));

      await expect(
        service.withdraw('user-id-1', mockAccount.id, new Prisma.Decimal('40')),
      ).rejects.toThrow(InsufficientFundsException);

      expect(repo.createLedgerEntry).not.toHaveBeenCalled();
    });

    it('throws ValidationException for a non-positive amount', async () => {
      await expect(
        service.withdraw('user-id-1', mockAccount.id, new Prisma.Decimal('-5')),
      ).rejects.toThrow(ValidationException);
    });

    it('throws ForbiddenException when withdrawing from a closed account', async () => {
      repo.findAccountById.mockResolvedValue(closedAccount);

      await expect(
        service.withdraw('user-id-1', closedAccount.id, new Prisma.Decimal('10')),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('internalTransferDebit', () => {
    it('creates a TRANSFER_DEBIT ledger entry with a negated amount', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.computeBalance
        .mockResolvedValueOnce(new Prisma.Decimal('100'))
        .mockResolvedValueOnce(new Prisma.Decimal('60'));

      const result = await service.internalTransferDebit(
        mockAccount.id,
        'transfer-id-1',
        new Prisma.Decimal('40'),
        Currency.USD,
        'transfer out',
      );

      const [, entry] = repo.createLedgerEntry.mock.calls[0]!;
      expect(entry.amount.toString()).toBe('-40');
      expect(entry.type).toBe(LedgerEntryType.TRANSFER_DEBIT);
      expect(entry.relatedTransactionId).toBe('transfer-id-1');
      expect(result.balance).toBe('60.00');
    });

    it('is idempotent: returns the current balance without writing again on a retry', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.findLedgerEntryByRelatedTransaction.mockResolvedValue(mockLedgerEntry);
      repo.computeBalance.mockResolvedValue(new Prisma.Decimal('60'));

      const result = await service.internalTransferDebit(
        mockAccount.id,
        'transfer-id-1',
        new Prisma.Decimal('40'),
        Currency.USD,
      );

      expect(repo.createLedgerEntry).not.toHaveBeenCalled();
      expect(result.balance).toBe('60.00');
    });

    it('throws InsufficientFundsException when the balance is too low', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.computeBalance.mockResolvedValue(new Prisma.Decimal('30'));

      await expect(
        service.internalTransferDebit(
          mockAccount.id,
          'transfer-id-1',
          new Prisma.Decimal('40'),
          Currency.USD,
        ),
      ).rejects.toThrow(InsufficientFundsException);

      expect(repo.createLedgerEntry).not.toHaveBeenCalled();
    });

    it('throws ValidationException for a non-positive amount', () => {
      expect(() =>
        service.internalTransferDebit(
          mockAccount.id,
          'transfer-id-1',
          new Prisma.Decimal('0'),
          Currency.USD,
        ),
      ).toThrow(ValidationException);
    });

    it('throws ForbiddenException when the account is closed', async () => {
      repo.findAccountById.mockResolvedValue(closedAccount);

      await expect(
        service.internalTransferDebit(
          closedAccount.id,
          'transfer-id-1',
          new Prisma.Decimal('10'),
          Currency.USD,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ValidationException when the requested currency does not match the account', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);

      await expect(
        service.internalTransferDebit(
          mockAccount.id,
          'transfer-id-1',
          new Prisma.Decimal('10'),
          Currency.EUR,
        ),
      ).rejects.toThrow(ValidationException);

      expect(repo.createLedgerEntry).not.toHaveBeenCalled();
    });
  });

  describe('internalTransferCredit', () => {
    it('creates a TRANSFER_CREDIT ledger entry without negating the amount', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.computeBalance.mockResolvedValue(new Prisma.Decimal('40'));

      const result = await service.internalTransferCredit(
        mockAccount.id,
        'transfer-id-1',
        new Prisma.Decimal('40'),
        Currency.USD,
        'transfer in',
      );

      const [, entry] = repo.createLedgerEntry.mock.calls[0]!;
      expect(entry.amount.toString()).toBe('40');
      expect(entry.type).toBe(LedgerEntryType.TRANSFER_CREDIT);
      expect(entry.relatedTransactionId).toBe('transfer-id-1');
      expect(result.balance).toBe('40.00');
    });

    it('is idempotent: returns the current balance without writing again on a retry', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.findLedgerEntryByRelatedTransaction.mockResolvedValue(mockLedgerEntry);
      repo.computeBalance.mockResolvedValue(new Prisma.Decimal('40'));

      const result = await service.internalTransferCredit(
        mockAccount.id,
        'transfer-id-1',
        new Prisma.Decimal('40'),
        Currency.USD,
      );

      expect(repo.createLedgerEntry).not.toHaveBeenCalled();
      expect(result.balance).toBe('40.00');
    });

    it('throws ForbiddenException when the account is closed', async () => {
      repo.findAccountById.mockResolvedValue(closedAccount);

      await expect(
        service.internalTransferCredit(
          closedAccount.id,
          'transfer-id-1',
          new Prisma.Decimal('10'),
          Currency.USD,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ValidationException when the requested currency does not match the account', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);

      await expect(
        service.internalTransferCredit(
          mockAccount.id,
          'transfer-id-1',
          new Prisma.Decimal('10'),
          Currency.EUR,
        ),
      ).rejects.toThrow(ValidationException);

      expect(repo.createLedgerEntry).not.toHaveBeenCalled();
    });
  });

  describe('internalTransferReversal', () => {
    it('creates a REVERSAL ledger entry without negating the amount', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.computeBalance.mockResolvedValue(new Prisma.Decimal('40'));

      const result = await service.internalTransferReversal(
        mockAccount.id,
        'transfer-id-1',
        new Prisma.Decimal('40'),
        Currency.USD,
        'reversed debit',
      );

      const [, entry] = repo.createLedgerEntry.mock.calls[0]!;
      expect(entry.amount.toString()).toBe('40');
      expect(entry.type).toBe(LedgerEntryType.REVERSAL);
      expect(entry.relatedTransactionId).toBe('transfer-id-1');
      expect(result.balance).toBe('40.00');
    });

    it('is idempotent: returns the current balance without writing again on a retry', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.findLedgerEntryByRelatedTransaction.mockResolvedValue(mockLedgerEntry);
      repo.computeBalance.mockResolvedValue(new Prisma.Decimal('40'));

      const result = await service.internalTransferReversal(
        mockAccount.id,
        'transfer-id-1',
        new Prisma.Decimal('40'),
        Currency.USD,
      );

      expect(repo.createLedgerEntry).not.toHaveBeenCalled();
      expect(result.balance).toBe('40.00');
    });

    it('throws ValidationException when the requested currency does not match the account', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);

      await expect(
        service.internalTransferReversal(
          mockAccount.id,
          'transfer-id-1',
          new Prisma.Decimal('10'),
          Currency.EUR,
        ),
      ).rejects.toThrow(ValidationException);

      expect(repo.createLedgerEntry).not.toHaveBeenCalled();
    });
  });

  describe('getLedger', () => {
    it('returns ledger entries for the owner', async () => {
      repo.findAccountById.mockResolvedValue(mockAccount);
      repo.findLedgerEntries.mockResolvedValue([mockLedgerEntry]);

      const result = await service.getLedger('user-id-1', mockAccount.id);

      expect(result).toHaveLength(1);
      expect(result[0]!.amount).toBe('100.00');
      expect(result[0]!.type).toBe(LedgerEntryType.DEPOSIT);
    });

    it('throws ForbiddenException for a non-owner', async () => {
      repo.findAccountById.mockResolvedValue(otherUsersAccount);

      await expect(service.getLedger('user-id-1', otherUsersAccount.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
