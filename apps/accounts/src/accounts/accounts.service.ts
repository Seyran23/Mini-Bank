import { Injectable } from '@nestjs/common';

import {
  ForbiddenException,
  InsufficientFundsException,
  NotFoundException,
  ValidationException,
} from '@minibank/errors';

import { Account, AccountStatus, Currency, LedgerEntryType, Prisma } from '@/generated/prisma';

import { AccountsRepository } from './accounts.repository';
import { AccountResponse } from './responses/account.response';
import { LedgerEntryResponse } from './responses/ledger-entry.response';

@Injectable()
export class AccountsService {
  constructor(private readonly repo: AccountsRepository) {}

  private async getOwnedAccount(userId: string, accountId: string): Promise<Account> {
    const acc = await this.repo.findAccountById(accountId);

    if (!acc) {
      throw new NotFoundException('Account', accountId);
    }

    if (acc.userId != userId) {
      throw new ForbiddenException('You are not the owner of this account!');
    }

    return acc;
  }

  private async getActiveAccount(accountId: string): Promise<Account> {
    const acc = await this.repo.findAccountById(accountId);

    if (!acc) {
      throw new NotFoundException('Account', accountId);
    }
    if (acc.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('This account is not active!');
    }

    return acc;
  }

  async createAccount(userId: string, currency: Currency): Promise<AccountResponse> {
    const newAccount = await this.repo.createAccount(userId, currency);
    return AccountResponse.from(newAccount, '0');
  }

  async getAccount(userId: string, accountId: string): Promise<AccountResponse> {
    const acc = await this.getOwnedAccount(userId, accountId);

    const balance = await this.repo.getBalance(accountId);

    return AccountResponse.from(acc, balance.toString());
  }

  async listAccounts(userId: string): Promise<AccountResponse[]> {
    const allUserAccounts = await this.repo.findAccountsByUserId(userId);

    return Promise.all(
      allUserAccounts.map(async (account) => {
        const balance = await this.repo.getBalance(account.id);
        return AccountResponse.from(account, balance.toString());
      }),
    );
  }

  async closeAccount(userId: string, accountId: string): Promise<string> {
    await this.getOwnedAccount(userId, accountId);

    await this.repo.updateAccountStatus(accountId, AccountStatus.CLOSED);

    return 'Account is closed successfully!';
  }

  async deposit(
    userId: string,
    accountId: string,
    amount: Prisma.Decimal,
    description?: string,
  ): Promise<AccountResponse> {
    if (amount.lte(0)) {
      throw new ValidationException('Amount must be greater than zero');
    }

    await this.getOwnedAccount(userId, accountId);

    return this.repo.withAccountLock(accountId, async (tx) => {
      const lockedAcc = await this.getActiveAccount(accountId);

      await this.repo.createLedgerEntry(tx, {
        accountId,
        amount,
        type: LedgerEntryType.DEPOSIT,
        description,
      });

      const balance = await this.repo.computeBalance(tx, accountId);

      return AccountResponse.from(lockedAcc, balance.toString());
    });
  }

  async withdraw(
    userId: string,
    accountId: string,
    amount: Prisma.Decimal,
    description?: string,
  ): Promise<AccountResponse> {
    if (amount.lte(0)) {
      throw new ValidationException('Amount must be greater than zero');
    }

    await this.getOwnedAccount(userId, accountId);

    return this.repo.withAccountLock(accountId, async (tx) => {
      const lockedAcc = await this.getActiveAccount(accountId);

      const balance = await this.repo.computeBalance(tx, accountId);

      if (balance.lt(amount)) {
        throw new InsufficientFundsException();
      }

      await this.repo.createLedgerEntry(tx, {
        accountId,
        amount: amount.negated(),
        type: LedgerEntryType.WITHDRAWAL,
        description,
      });

      const newBalance = await this.repo.computeBalance(tx, accountId);

      return AccountResponse.from(lockedAcc, newBalance.toString());
    });
  }

  async getLedger(userId: string, accountId: string): Promise<LedgerEntryResponse[]> {
    await this.getOwnedAccount(userId, accountId);

    const ledgerEntries = await this.repo.findLedgerEntries(accountId);

    return ledgerEntries.map((entry) => LedgerEntryResponse.from(entry));
  }

  internalTransferDebit(
    accountId: string,
    transferId: string,
    amount: Prisma.Decimal,
    description?: string,
  ): Promise<AccountResponse> {
    if (amount.lte(0)) {
      throw new ValidationException('Amount must be greater than zero');
    }

    return this.repo.withAccountLock(accountId, async (tx) => {
      const lockedAcc = await this.getActiveAccount(accountId);

      const existing = await this.repo.findLedgerEntryByRelatedTransaction(
        tx,
        accountId,
        transferId,
        LedgerEntryType.TRANSFER_DEBIT,
      );

      if (existing) {
        const balance = await this.repo.computeBalance(tx, accountId);
        return AccountResponse.from(lockedAcc, balance.toString());
      }

      const balance = await this.repo.computeBalance(tx, accountId);

      if (balance.lt(amount)) {
        throw new InsufficientFundsException();
      }

      await this.repo.createLedgerEntry(tx, {
        accountId,
        amount: amount.negated(),
        type: LedgerEntryType.TRANSFER_DEBIT,
        relatedTransactionId: transferId,
        description,
      });

      const newBalance = await this.repo.computeBalance(tx, accountId);

      return AccountResponse.from(lockedAcc, newBalance.toString());
    });
  }

  internalTransferCredit(
    accountId: string,
    transferId: string,
    amount: Prisma.Decimal,
    description?: string,
  ): Promise<AccountResponse> {
    if (amount.lte(0)) {
      throw new ValidationException('Amount must be greater than zero');
    }

    return this.repo.withAccountLock(accountId, async (tx) => {
      const lockedAcc = await this.getActiveAccount(accountId);

      const existing = await this.repo.findLedgerEntryByRelatedTransaction(
        tx,
        accountId,
        transferId,
        LedgerEntryType.TRANSFER_CREDIT,
      );

      if (existing) {
        const balance = await this.repo.computeBalance(tx, accountId);
        return AccountResponse.from(lockedAcc, balance.toString());
      }

      await this.repo.createLedgerEntry(tx, {
        accountId,
        amount,
        type: LedgerEntryType.TRANSFER_CREDIT,
        relatedTransactionId: transferId,
        description,
      });

      const newBalance = await this.repo.computeBalance(tx, accountId);

      return AccountResponse.from(lockedAcc, newBalance.toString());
    });
  }

  internalTransferReversal(
    accountId: string,
    transferId: string,
    amount: Prisma.Decimal,
    description?: string,
  ): Promise<AccountResponse> {
    if (amount.lte(0)) {
      throw new ValidationException('Amount must be greater than zero');
    }

    return this.repo.withAccountLock(accountId, async (tx) => {
      const lockedAcc = await this.getActiveAccount(accountId);

      const existing = await this.repo.findLedgerEntryByRelatedTransaction(
        tx,
        accountId,
        transferId,
        LedgerEntryType.REVERSAL,
      );

      if (existing) {
        const balance = await this.repo.computeBalance(tx, accountId);
        return AccountResponse.from(lockedAcc, balance.toString());
      }

      await this.repo.createLedgerEntry(tx, {
        accountId,
        amount,
        type: LedgerEntryType.REVERSAL,
        relatedTransactionId: transferId,
        description,
      });

      const newBalance = await this.repo.computeBalance(tx, accountId);

      return AccountResponse.from(lockedAcc, newBalance.toString());
    });
  }
}
