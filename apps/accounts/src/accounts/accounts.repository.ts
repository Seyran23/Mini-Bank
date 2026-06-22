import { Injectable } from '@nestjs/common';

import {
  Account,
  AccountStatus,
  Currency,
  LedgerEntry,
  LedgerEntryType,
  Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createAccount(userId: string, currency: Currency): Promise<Account> {
    return this.prisma.account.create({
      data: { userId, currency },
    });
  }

  findAccountById(id: string): Promise<Account | null> {
    return this.prisma.account.findUnique({ where: { id } });
  }

  findAccountsByUserId(userId: string): Promise<Account[]> {
    return this.prisma.account.findMany({ where: { userId } });
  }

  updateAccountStatus(id: string, status: AccountStatus): Promise<Account> {
    return this.prisma.account.update({ where: { id }, data: { status } });
  }

  async computeBalance(
    tx: Prisma.TransactionClient | PrismaService,
    accountId: string,
  ): Promise<Prisma.Decimal> {
    const result = await tx.ledgerEntry.aggregate({
      where: { accountId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  getBalance(accountId: string): Promise<Prisma.Decimal> {
    return this.computeBalance(this.prisma, accountId);
  }

  createLedgerEntry(
    tx: Prisma.TransactionClient,
    data: {
      accountId: string;
      amount: Prisma.Decimal;
      type: LedgerEntryType;
      description?: string;
      relatedTransactionId?: string;
    },
  ): Promise<LedgerEntry> {
    return tx.ledgerEntry.create({ data });
  }

  findLedgerEntries(accountId: string): Promise<LedgerEntry[]> {
    return this.prisma.ledgerEntry.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findLedgerEntryByRelatedTransaction(
    tx: Prisma.TransactionClient,
    accountId: string,
    relatedTransactionId: string,
    type: LedgerEntryType,
  ): Promise<LedgerEntry | null> {
    return tx.ledgerEntry.findFirst({
      where: { accountId, relatedTransactionId, type },
    });
  }

  withAccountLock<T>(
    accountId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${accountId} FOR UPDATE`;
      return fn(tx);
    });
  }
}
