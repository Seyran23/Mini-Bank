import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { createLogger } from '@minibank/logger';
import { TransferCompletedEvent, TransferFailedEvent } from '@minibank/types';

import { AccountsClient } from '@/accounts-client/accounts-client.service';
import { transfersConfig } from '@/config/transfers.config';
import { Prisma, SagaState, Transfer } from '@/generated/prisma';
import { TransfersRepository } from '@/transfers/transfers.repository';

@Injectable()
export class TransferSagaRunner {
  private readonly logger = createLogger('transfers');

  constructor(
    private readonly repo: TransfersRepository,
    private readonly accountsClient: AccountsClient,
  ) {}

  @Interval(Number(transfersConfig.SAGA_POLL_INTERVAL_MS))
  async tick(): Promise<void> {
    const allNonTerminatedTransfers = await this.repo.findNonTerminalTransfers();

    for (const transfer of allNonTerminatedTransfers) {
      try {
        await this.advance(transfer);
      } catch (err) {
        this.logger.error({ err, transferId: transfer.id }, 'Failed to advance transfer');
      }
    }
  }

  private async advance(transfer: Transfer): Promise<void> {
    switch (transfer.sagaState) {
      case SagaState.INITIATED:
        await this.repo.claimTransfer(transfer.id, SagaState.INITIATED, SagaState.DEBIT_PENDING);
        break;
      case SagaState.DEBIT_PENDING:
        try {
          await this.accountsClient.transferDebit(
            transfer.fromAccountId,
            transfer.id,
            transfer.amount.toString(),
            transfer.correlationId ?? randomUUID(),
          );
          await this.repo.claimTransfer(
            transfer.id,
            SagaState.DEBIT_PENDING,
            SagaState.DEBIT_COMPLETE,
          );
        } catch (e) {
          await this.repo.advanceSagaStateWithOutboxEvent(
            transfer.id,
            SagaState.FAILED,
            this.buildTransferFailedEvent(transfer, this.errorMessage(e)),
            this.errorMessage(e),
          );
        }
        break;
      case SagaState.DEBIT_COMPLETE:
        await this.repo.claimTransfer(
          transfer.id,
          SagaState.DEBIT_COMPLETE,
          SagaState.CREDIT_PENDING,
        );

        break;
      case SagaState.CREDIT_PENDING:
        try {
          await this.accountsClient.transferCredit(
            transfer.toAccountId,
            transfer.id,
            transfer.amount.toString(),
            transfer.correlationId ?? randomUUID(),
          );

          await this.repo.advanceSagaStateWithOutboxEvent(
            transfer.id,
            SagaState.COMPLETED,
            this.buildCompletedEvent(transfer),
          );
        } catch (e) {
          await this.repo.advanceSagaState(
            transfer.id,
            SagaState.COMPENSATING,
            this.errorMessage(e),
          );
        }

        break;
      case SagaState.COMPENSATING:
        try {
          await this.accountsClient.reversal(
            transfer.fromAccountId,
            transfer.id,
            transfer.amount.toString(),
            transfer.correlationId ?? randomUUID(),
          );
          await this.repo.advanceSagaStateWithOutboxEvent(
            transfer.id,
            SagaState.COMPENSATED,
            this.buildTransferFailedEvent(transfer, 'Credit failed; debit was reversed'),
          );
        } catch {}
        break;
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private buildTransferFailedEvent(
    transfer: Transfer,
    reason: string,
  ): { eventType: string; payload: Prisma.InputJsonValue } {
    const event: TransferFailedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      correlationId: transfer.correlationId ?? randomUUID(),
      type: 'transfer.failed',
      payload: {
        transferId: transfer.id,
        reason,
        userId: transfer.userId,
      },
    };

    return { eventType: 'transfer.failed', payload: event as unknown as Prisma.InputJsonValue };
  }

  private buildCompletedEvent(transfer: Transfer): {
    eventType: string;
    payload: Prisma.InputJsonValue;
  } {
    const event: TransferCompletedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      correlationId: transfer.correlationId ?? randomUUID(),
      type: 'transfer.completed',
      payload: {
        transferId: transfer.id,
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        amount: transfer.amount.toString(),
        currency: transfer.currency as unknown as TransferCompletedEvent['payload']['currency'],
        userId: transfer.userId,
      },
    };

    return { eventType: 'transfer.completed', payload: event as unknown as Prisma.InputJsonValue };
  }
}
