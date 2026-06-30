import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaClient } from '@/generated/prisma';

type PrismaLogOptions = {
  log: [{ emit: 'event'; level: 'query' }, { emit: 'event'; level: 'error' }];
};

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class PrismaService
  extends PrismaClient<PrismaLogOptions>
  implements OnModuleInit, OnModuleDestroy
{
  onTransactionComplete?: (durationMs: number, status: 'success' | 'error') => void;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async runInTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    const start = Date.now();
    let succeeded = true;
    try {
      return await this.$transaction(fn);
    } catch (err) {
      succeeded = false;
      throw err;
    } finally {
      this.onTransactionComplete?.(Date.now() - start, succeeded ? 'success' : 'error');
    }
  }
}
