import { Test, TestingModule } from '@nestjs/testing';

import { ForbiddenException, NotFoundException, ValidationException } from '@minibank/errors';

import { AccountSnapshot, AccountsClient } from '@/accounts-client/accounts-client.service';
import { Currency, Prisma, SagaState, Transfer } from '@/generated/prisma';

import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransfersRepository } from './transfers.repository';
import { TransfersService } from './transfers.service';

const userId = 'user-id-1';
const otherUserId = 'user-id-2';

const mockAccount: AccountSnapshot = {
  id: 'account-id-1',
  userId,
  currency: Currency.USD,
  status: 'ACTIVE',
  balance: '100.00',
};

const mockDto: CreateTransferDto = {
  fromAccountId: mockAccount.id,
  toAccountId: 'account-id-2',
  amount: '40',
  currency: Currency.USD,
};

const mockTransfer: Transfer = {
  id: 'transfer-id-1',
  userId,
  fromAccountId: mockDto.fromAccountId,
  toAccountId: mockDto.toAccountId,
  amount: new Prisma.Decimal('40'),
  currency: Currency.USD,
  sagaState: SagaState.INITIATED,
  failureReason: null,
  correlationId: 'correlation-id-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('TransfersService', () => {
  let service: TransfersService;
  let repo: jest.Mocked<TransfersRepository>;
  let accountsClient: jest.Mocked<AccountsClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        {
          provide: TransfersRepository,
          useValue: {
            createTransfer: jest.fn(),
            findTransferById: jest.fn(),
            findTransfersByUserId: jest.fn(),
          },
        },
        {
          provide: AccountsClient,
          useValue: {
            getAccount: jest.fn(),
            getAccountInternal: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(TransfersService);
    repo = module.get(TransfersRepository);
    accountsClient = module.get(AccountsClient);
  });

  afterEach(() => jest.clearAllMocks());

  describe('initiateTransfer', () => {
    it('creates a transfer once pre-flight checks pass', async () => {
      accountsClient.getAccount.mockResolvedValue(mockAccount);
      accountsClient.getAccountInternal.mockResolvedValue({
        ...mockAccount,
        id: mockDto.toAccountId,
      });
      repo.createTransfer.mockResolvedValue(mockTransfer);

      const result = await service.initiateTransfer(
        userId,
        'access-token',
        'correlation-id-1',
        mockDto,
      );

      expect(accountsClient.getAccount).toHaveBeenCalledWith(
        mockDto.fromAccountId,
        'access-token',
        'correlation-id-1',
      );
      expect(accountsClient.getAccountInternal).toHaveBeenCalledWith(
        mockDto.toAccountId,
        'correlation-id-1',
      );
      expect(repo.createTransfer).toHaveBeenCalledWith({
        userId,
        fromAccountId: mockDto.fromAccountId,
        toAccountId: mockDto.toAccountId,
        currency: mockDto.currency,
        correlationId: 'correlation-id-1',
        amount: new Prisma.Decimal('40'),
      });
      expect(result.id).toBe(mockTransfer.id);
      expect(result.status).toBe(SagaState.INITIATED);
    });

    it('throws ForbiddenException when the account does not belong to the caller', async () => {
      accountsClient.getAccount.mockResolvedValue({ ...mockAccount, userId: otherUserId });

      await expect(
        service.initiateTransfer(userId, 'access-token', 'correlation-id-1', mockDto),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.createTransfer).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the account is not active', async () => {
      accountsClient.getAccount.mockResolvedValue({ ...mockAccount, status: 'CLOSED' });

      await expect(
        service.initiateTransfer(userId, 'access-token', 'correlation-id-1', mockDto),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.createTransfer).not.toHaveBeenCalled();
    });

    it('throws ValidationException when the source currency does not match', async () => {
      accountsClient.getAccount.mockResolvedValue({ ...mockAccount, currency: Currency.EUR });

      await expect(
        service.initiateTransfer(userId, 'access-token', 'correlation-id-1', mockDto),
      ).rejects.toThrow(ValidationException);
      expect(repo.createTransfer).not.toHaveBeenCalled();
    });

    it('throws ValidationException when the destination currency does not match', async () => {
      accountsClient.getAccount.mockResolvedValue(mockAccount);
      accountsClient.getAccountInternal.mockResolvedValue({
        ...mockAccount,
        id: mockDto.toAccountId,
        currency: Currency.EUR,
      });

      await expect(
        service.initiateTransfer(userId, 'access-token', 'correlation-id-1', mockDto),
      ).rejects.toThrow(ValidationException);
      expect(repo.createTransfer).not.toHaveBeenCalled();
    });

    it('propagates errors from the pre-flight account lookup', async () => {
      accountsClient.getAccount.mockRejectedValue(new NotFoundException('Account', mockAccount.id));

      await expect(
        service.initiateTransfer(userId, 'access-token', 'correlation-id-1', mockDto),
      ).rejects.toThrow(NotFoundException);
      expect(repo.createTransfer).not.toHaveBeenCalled();
    });
  });

  describe('getTransfer', () => {
    it('returns the transfer for its owner', async () => {
      repo.findTransferById.mockResolvedValue(mockTransfer);

      const result = await service.getTransfer(userId, mockTransfer.id);

      expect(result.id).toBe(mockTransfer.id);
    });

    it('throws NotFoundException when the transfer does not exist', async () => {
      repo.findTransferById.mockResolvedValue(null);

      await expect(service.getTransfer(userId, 'missing-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a non-owner', async () => {
      repo.findTransferById.mockResolvedValue(mockTransfer);

      await expect(service.getTransfer(otherUserId, mockTransfer.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('listTransfers', () => {
    it('returns all transfers for a user', async () => {
      repo.findTransfersByUserId.mockResolvedValue([mockTransfer]);

      const result = await service.listTransfers(userId);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(mockTransfer.id);
    });
  });
});
