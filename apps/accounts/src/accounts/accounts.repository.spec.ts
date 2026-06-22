import { execSync } from 'node:child_process';
import path from 'node:path';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { AccountsRepository } from '@/accounts/accounts.repository';
import { AccountStatus, Currency, LedgerEntryType, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/prisma/prisma.service';

const SERVICE_ROOT = path.resolve(__dirname, '../..');

describe('AccountsRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaService;
  let repo: AccountsRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    process.env['ACCOUNTS_DATABASE_URL'] = container.getConnectionUri();

    execSync('npx prisma migrate deploy', {
      cwd: SERVICE_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
    });

    prisma = new PrismaService();
    await prisma.onModuleInit();
    repo = new AccountsRepository(prisma);
  }, 60_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await container.stop();
  });

  beforeEach(async () => {
    await prisma.ledgerEntry.deleteMany();
    await prisma.account.deleteMany();
  });

  const userId = 'user-id-1';

  describe('createAccount / findAccountById / findAccountsByUserId', () => {
    it('persists an account and retrieves it by id', async () => {
      const account = await repo.createAccount(userId, Currency.USD);

      const found = await repo.findAccountById(account.id);

      expect(found).not.toBeNull();
      expect(found!.userId).toBe(userId);
      expect(found!.currency).toBe(Currency.USD);
      expect(found!.status).toBe(AccountStatus.ACTIVE);
    });

    it('returns null for a non-existent id', async () => {
      const found = await repo.findAccountById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });

    it('returns all accounts for a user', async () => {
      await repo.createAccount(userId, Currency.USD);
      await repo.createAccount(userId, Currency.EUR);
      await repo.createAccount('user-id-2', Currency.GBP);

      const accounts = await repo.findAccountsByUserId(userId);

      expect(accounts).toHaveLength(2);
    });
  });

  describe('updateAccountStatus', () => {
    it('updates the account status', async () => {
      const account = await repo.createAccount(userId, Currency.USD);

      const updated = await repo.updateAccountStatus(account.id, AccountStatus.CLOSED);

      expect(updated.status).toBe(AccountStatus.CLOSED);
    });
  });

  describe('computeBalance / getBalance', () => {
    it('returns zero for an account with no ledger entries', async () => {
      const account = await repo.createAccount(userId, Currency.USD);

      const balance = await repo.getBalance(account.id);

      expect(balance.toString()).toBe('0');
    });

    it('returns the sum of ledger entries', async () => {
      const account = await repo.createAccount(userId, Currency.USD);

      await repo.createLedgerEntry(prisma, {
        accountId: account.id,
        amount: new Prisma.Decimal('100'),
        type: LedgerEntryType.DEPOSIT,
      });
      await repo.createLedgerEntry(prisma, {
        accountId: account.id,
        amount: new Prisma.Decimal('-30'),
        type: LedgerEntryType.WITHDRAWAL,
      });

      const balance = await repo.getBalance(account.id);

      expect(balance.toString()).toBe('70');
    });
  });

  describe('createLedgerEntry / findLedgerEntries', () => {
    it('returns entries ordered by creation time', async () => {
      const account = await repo.createAccount(userId, Currency.USD);

      await repo.createLedgerEntry(prisma, {
        accountId: account.id,
        amount: new Prisma.Decimal('100'),
        type: LedgerEntryType.DEPOSIT,
        description: 'first',
      });
      await repo.createLedgerEntry(prisma, {
        accountId: account.id,
        amount: new Prisma.Decimal('-20'),
        type: LedgerEntryType.WITHDRAWAL,
        description: 'second',
      });

      const entries = await repo.findLedgerEntries(account.id);

      expect(entries).toHaveLength(2);
      expect(entries[0]!.description).toBe('first');
      expect(entries[1]!.description).toBe('second');
    });
  });

  describe('findLedgerEntryByRelatedTransaction', () => {
    it('returns null when no entry exists for the transfer', async () => {
      const account = await repo.createAccount(userId, Currency.USD);

      const found = await repo.findLedgerEntryByRelatedTransaction(
        prisma,
        account.id,
        'transfer-id-1',
        LedgerEntryType.TRANSFER_DEBIT,
      );

      expect(found).toBeNull();
    });

    it('finds the entry by accountId + relatedTransactionId + type', async () => {
      const account = await repo.createAccount(userId, Currency.USD);

      await repo.createLedgerEntry(prisma, {
        accountId: account.id,
        amount: new Prisma.Decimal('-40'),
        type: LedgerEntryType.TRANSFER_DEBIT,
        relatedTransactionId: 'transfer-id-1',
      });

      const found = await repo.findLedgerEntryByRelatedTransaction(
        prisma,
        account.id,
        'transfer-id-1',
        LedgerEntryType.TRANSFER_DEBIT,
      );

      expect(found).not.toBeNull();
      expect(found!.relatedTransactionId).toBe('transfer-id-1');
    });

    it('does not match a different type for the same transfer', async () => {
      const account = await repo.createAccount(userId, Currency.USD);

      await repo.createLedgerEntry(prisma, {
        accountId: account.id,
        amount: new Prisma.Decimal('-40'),
        type: LedgerEntryType.TRANSFER_DEBIT,
        relatedTransactionId: 'transfer-id-1',
      });

      const found = await repo.findLedgerEntryByRelatedTransaction(
        prisma,
        account.id,
        'transfer-id-1',
        LedgerEntryType.TRANSFER_CREDIT,
      );

      expect(found).toBeNull();
    });
  });

  describe('withAccountLock', () => {
    async function tryWithdraw(accountId: string, amount: string): Promise<boolean> {
      return repo.withAccountLock(accountId, async (tx) => {
        const balance = await repo.computeBalance(tx, accountId);

        if (balance.lt(amount)) {
          return false;
        }

        await repo.createLedgerEntry(tx, {
          accountId,
          amount: new Prisma.Decimal(amount).negated(),
          type: LedgerEntryType.WITHDRAWAL,
        });

        return true;
      });
    }

    it('serializes concurrent withdrawals so the balance never goes negative', async () => {
      const account = await repo.createAccount(userId, Currency.USD);

      await repo.createLedgerEntry(prisma, {
        accountId: account.id,
        amount: new Prisma.Decimal('100'),
        type: LedgerEntryType.DEPOSIT,
      });

      // Two concurrent $60 withdrawals against a $100 balance — without the
      // FOR UPDATE lock, both could read balance=100, both pass the
      // sufficient-funds check, and both commit, leaving balance=-20.
      const results = await Promise.all([
        tryWithdraw(account.id, '60'),
        tryWithdraw(account.id, '60'),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);

      const finalBalance = await repo.getBalance(account.id);
      expect(finalBalance.toString()).toBe('40');
    });
  });
});
