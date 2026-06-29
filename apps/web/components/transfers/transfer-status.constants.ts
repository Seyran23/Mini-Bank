import type { TransferStatus } from '@/lib/types/transfer';

export const TRANSFER_STATUS_COPY: Record<TransferStatus, string> = {
  INITIATED: 'Transfer initiated…',
  DEBIT_PENDING: 'Withdrawing funds from the source account…',
  DEBIT_COMPLETE: 'Funds withdrawn, crediting the destination account…',
  CREDIT_PENDING: 'Crediting the destination account…',
  COMPLETED: 'Transfer complete.',
  COMPENSATING: 'Something went wrong — reversing the withdrawal…',
  COMPENSATED: 'Transfer failed and the withdrawal was reversed.',
  FAILED: 'Transfer failed.',
};
