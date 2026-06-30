import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';

import { PrismaService } from './prisma.service';

const SLOW_QUERY_THRESHOLD_MS = 100;

@Injectable()
export class PrismaMetricsService implements OnModuleInit {
  private readonly slowQueryCounter = new Counter({
    name: 'db_queries_slow_total',
    help: 'Total DB queries exceeding 100ms',
  });

  private readonly failedQueryCounter = new Counter({
    name: 'db_queries_failed_total',
    help: 'Total DB queries that resulted in an error',
  });

  private readonly queryDurationHistogram = new Histogram({
    name: 'db_query_duration_ms',
    help: 'DB query duration in milliseconds',
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  });

  private readonly txDurationHistogram = new Histogram({
    name: 'db_transaction_duration_ms',
    help: 'DB transaction duration in milliseconds',
    labelNames: ['status'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  });

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.prisma.$on('query', (event) => {
      this.queryDurationHistogram.observe(event.duration);
      if (event.duration > SLOW_QUERY_THRESHOLD_MS) {
        this.slowQueryCounter.inc();
      }
    });

    this.prisma.$on('error', () => {
      this.failedQueryCounter.inc();
    });

    this.prisma.onTransactionComplete = (durationMs, status) => {
      this.txDurationHistogram.observe({ status }, durationMs);
    };

    const prismaRef = this.prisma;

    new Gauge({
      name: 'db_connections_active',
      help: 'Active PostgreSQL connections for this database',
      async collect() {
        try {
          const rows = await prismaRef.$queryRaw<Array<{ count: bigint }>>`
            SELECT count(*) FROM pg_stat_activity
            WHERE datname = current_database() AND state = 'active'
          `;
          this.set(Number(rows[0]?.count ?? 0));
        } catch {
          this.set(0);
        }
      },
    });

    new Gauge({
      name: 'db_connections_idle',
      help: 'Idle PostgreSQL connections for this database',
      async collect() {
        try {
          const rows = await prismaRef.$queryRaw<Array<{ count: bigint }>>`
            SELECT count(*) FROM pg_stat_activity
            WHERE datname = current_database() AND state = 'idle'
          `;
          this.set(Number(rows[0]?.count ?? 0));
        } catch {
          this.set(0);
        }
      },
    });

    new Gauge({
      name: 'db_connections_total',
      help: 'Total PostgreSQL connections for this database',
      async collect() {
        try {
          const rows = await prismaRef.$queryRaw<Array<{ count: bigint }>>`
            SELECT count(*) FROM pg_stat_activity
            WHERE datname = current_database()
          `;
          this.set(Number(rows[0]?.count ?? 0));
        } catch {
          this.set(0);
        }
      },
    });
  }
}
