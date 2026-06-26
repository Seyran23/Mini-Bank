import { Injectable } from '@nestjs/common';

import { ForbiddenException, NotFoundException, ValidationException } from '@minibank/errors';
import { createLogger } from '@minibank/logger';

import { AccountsClient } from '@/accounts-client/accounts-client.service';
import { Prisma } from '@/generated/prisma';

import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferResponse } from './responses/transfer.response';
import { TransfersRepository } from './transfers.repository';

@Injectable()
export class TransfersService {
  private readonly logger = createLogger('transfers');

  constructor(
    private readonly repo: TransfersRepository,
    private readonly accountsClient: AccountsClient,
  ) {}

  async initiateTransfer(
    userId: string,
    accessToken: string,
    correlationId: string,
    dto: CreateTransferDto,
  ): Promise<TransferResponse> {
    const account = await this.accountsClient.getAccount(
      dto.fromAccountId,
      accessToken,
      correlationId,
    );

    if (userId !== account.userId) {
      this.logger.warn(
        { userId, accountId: dto.fromAccountId, correlationId },
        'Transfer rejected: account does not belong to user',
      );
      throw new ForbiddenException('This account does not belong to you!');
    }

    if (account.status !== 'ACTIVE') {
      this.logger.warn(
        { userId, accountId: dto.fromAccountId, correlationId },
        'Transfer rejected: source account is not active',
      );
      throw new ForbiddenException('This account is not active!');
    }

    if (account.currency !== dto.currency) {
      this.logger.warn(
        { userId, accountId: dto.fromAccountId, correlationId },
        'Transfer rejected: currency mismatch',
      );
      throw new ValidationException('Currencies should match for being able to transfer');
    }

    const newTransfer = await this.repo.createTransfer({
      userId,
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      currency: dto.currency,
      correlationId,
      amount: new Prisma.Decimal(dto.amount),
    });

    this.logger.info(
      {
        userId,
        transferId: newTransfer.id,
        correlationId,
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        amount: dto.amount,
      },
      'Transfer initiated',
    );

    return TransferResponse.from(newTransfer);
  }

  async getTransfer(userId: string, transferId: string): Promise<TransferResponse> {
    const transfer = await this.repo.findTransferById(transferId);

    if (!transfer) {
      throw new NotFoundException('Transfer', transferId);
    }

    if (transfer.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this transfer!');
    }

    return TransferResponse.from(transfer);
  }

  async listTransfers(userId: string): Promise<TransferResponse[]> {
    const transfers = await this.repo.findTransfersByUserId(userId);

    return transfers.map((t) => TransferResponse.from(t));
  }
}
