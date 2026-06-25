import { Injectable } from '@nestjs/common';

import { Currency, OutBoxEvent, Prisma, SagaState, Transfer } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TransfersRepository {
  constructor(private readonly prisma: PrismaService) {}

  createTransfer(data: {
    userId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: Prisma.Decimal;
    currency: Currency;
    correlationId: string;
  }): Promise<Transfer> {
    return this.prisma.transfer.create({ data });
  }

  findTransferById(id: string): Promise<Transfer | null> {
    return this.prisma.transfer.findUnique({ where: { id } });
  }

  findTransfersByUserId(userId: string): Promise<Transfer[]> {
    return this.prisma.transfer.findMany({ where: { userId } });
  }

  findNonTerminalTransfers(): Promise<Transfer[]> {
    return this.prisma.transfer.findMany({
      where: {
        sagaState: {
          in: [
            SagaState.INITIATED,
            SagaState.DEBIT_PENDING,
            SagaState.DEBIT_COMPLETE,
            SagaState.CREDIT_PENDING,
            SagaState.COMPENSATING,
          ],
        },
      },
    });
  }

  async claimTransfer(
    transferId: string,
    fromState: SagaState,
    toState: SagaState,
  ): Promise<boolean> {
    const { count } = await this.prisma.transfer.updateMany({
      where: { id: transferId, sagaState: fromState },
      data: { sagaState: toState },
    });

    return count === 1;
  }

  advanceSagaState(
    transferId: string,
    sagaState: SagaState,
    failureReason?: string,
  ): Promise<Transfer> {
    return this.prisma.transfer.update({
      where: { id: transferId },
      data: { sagaState, failureReason },
    });
  }

  advanceSagaStateWithOutboxEvent(
    transferId: string,
    sagaState: SagaState,
    outboxEvent: { eventType: string; payload: Prisma.InputJsonValue },
    failureReason?: string,
  ): Promise<Transfer> {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.update({
        where: { id: transferId },
        data: { sagaState, failureReason },
      });

      await tx.outBoxEvent.create({
        data: { eventType: outboxEvent.eventType, payload: outboxEvent.payload },
      });

      return transfer;
    });
  }

  findUnpublishedOutboxEvents(): Promise<OutBoxEvent[]> {
    return this.prisma.outBoxEvent.findMany({ where: { publishedAt: null } });
  }

  markOutboxEventPublished(id: string): Promise<OutBoxEvent> {
    return this.prisma.outBoxEvent.update({ where: { id }, data: { publishedAt: new Date() } });
  }
}
