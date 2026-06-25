import { Currency, SagaState, Transfer } from '@/generated/prisma';

export class TransferResponse {
  id!: string;
  fromAccountId!: string;
  toAccountId!: string;
  amount!: string;
  currency!: Currency;
  status!: SagaState;
  failureReason!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  static from(transfer: Transfer): TransferResponse {
    return {
      id: transfer.id,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: transfer.amount.toFixed(2),
      currency: transfer.currency,
      status: transfer.sagaState,
      failureReason: transfer.failureReason ?? null,
      createdAt: transfer.createdAt,
      updatedAt: transfer.updatedAt,
    };
  }
}
