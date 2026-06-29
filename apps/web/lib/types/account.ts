export type Currency = 'USD' | 'EUR' | 'GBP';
export type AccountStatus = 'ACTIVE' | 'CLOSED';

export interface Account {
  id: string;
  userId: string;
  currency: Currency;
  status: AccountStatus;
  balance: string;
  createdAt: string;
}

export type LedgerEntryType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER_DEBIT'
  | 'TRANSFER_CREDIT'
  | 'REVERSAL';

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  amount: string;
  description: string | null;
  createdAt: string;
}

export type AmountActionResult = { account: Account; error?: undefined } | { error: string };
