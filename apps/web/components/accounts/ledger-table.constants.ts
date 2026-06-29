import type { LedgerEntry } from '@/lib/types/account';

export const LEDGER_PAGE_SIZE = 10;

export const LEDGER_TYPE_VARIANT: Record<
  LedgerEntry['type'],
  'default' | 'destructive' | 'outline'
> = {
  DEPOSIT: 'default',
  TRANSFER_CREDIT: 'default',
  WITHDRAWAL: 'destructive',
  TRANSFER_DEBIT: 'destructive',
  REVERSAL: 'outline',
};
