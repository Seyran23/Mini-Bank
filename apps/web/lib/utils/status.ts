import type { AccountStatus } from '@/lib/types/account';
import type { TransferStatus } from '@/lib/types/transfer';

export type StatusBadgeVariant = 'default' | 'destructive' | 'outline';

export function accountStatusVariant(status: AccountStatus): StatusBadgeVariant {
  return status === 'ACTIVE' ? 'default' : 'outline';
}

export const TRANSFER_TERMINAL_STATUSES: TransferStatus[] = ['COMPLETED', 'COMPENSATED', 'FAILED'];

export function isTransferTerminal(status: TransferStatus): boolean {
  return TRANSFER_TERMINAL_STATUSES.includes(status);
}

export function transferStatusVariant(status: TransferStatus): StatusBadgeVariant {
  if (status === 'COMPLETED') {
    return 'default';
  }
  if (status === 'COMPENSATED' || status === 'FAILED') {
    return 'destructive';
  }
  return 'outline';
}
