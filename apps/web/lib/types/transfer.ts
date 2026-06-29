import type { Currency } from './account';

export type TransferStatus =
  | 'INITIATED'
  | 'DEBIT_PENDING'
  | 'DEBIT_COMPLETE'
  | 'CREDIT_PENDING'
  | 'COMPLETED'
  | 'COMPENSATING'
  | 'COMPENSATED'
  | 'FAILED';

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  currency: Currency;
  status: TransferStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransferPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  currency: Currency;
  description?: string;
}

export type CreateTransferResult = { transfer: Transfer; error?: undefined } | { error: string };
