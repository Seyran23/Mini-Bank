import { LedgerEntry, LedgerEntryType } from '@/generated/prisma';

export class LedgerEntryResponse {
  id!: string;
  type!: LedgerEntryType;
  amount!: string;
  description!: string | null;
  createdAt!: Date;

  static from(entry: LedgerEntry): LedgerEntryResponse {
    return {
      id: entry.id,
      type: entry.type,
      amount: Number(entry.amount).toFixed(2),
      description: entry?.description,
      createdAt: entry.createdAt,
    };
  }
}
