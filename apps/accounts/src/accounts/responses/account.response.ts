import { Account, AccountStatus, Currency } from '@/generated/prisma';

export class AccountResponse {
  id!: string;
  userId!: string;
  currency!: Currency;
  status!: AccountStatus;
  balance!: string;
  createdAt!: Date;

  static from(account: Account, balance: string): AccountResponse {
    return {
      id: account.id,
      userId: account.userId,
      currency: account.currency,
      status: account.status,
      balance: Number(balance).toFixed(2),
      createdAt: account.createdAt,
    };
  }
}
