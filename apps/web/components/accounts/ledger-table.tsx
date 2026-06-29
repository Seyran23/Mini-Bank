'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getLedgerAction } from '@/lib/actions/accounts.actions';
import { ledgerKey } from '@/lib/query/keys';
import { formatDateTime, formatSignedCurrency } from '@/lib/utils/format';

import { LEDGER_PAGE_SIZE, LEDGER_TYPE_VARIANT } from './ledger-table.constants';

export function LedgerTable({ accountId, currency }: { accountId: string; currency: string }) {
  const [pageIndex, setPageIndex] = useState(0);
  const { data, isLoading, isError } = useQuery({
    queryKey: ledgerKey(accountId),
    queryFn: () => getLedgerAction(accountId),
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive">Could not load the ledger.</p>;
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No transactions yet.</p>;
  }

  const pageCount = Math.ceil(data.length / LEDGER_PAGE_SIZE);
  const page = data.slice(
    pageIndex * LEDGER_PAGE_SIZE,
    pageIndex * LEDGER_PAGE_SIZE + LEDGER_PAGE_SIZE,
  );

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                <Badge variant={LEDGER_TYPE_VARIANT[entry.type]}>{entry.type}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{entry.description ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(entry.createdAt)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatSignedCurrency(entry.amount, currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((i) => i - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex === pageCount - 1}
            onClick={() => setPageIndex((i) => i + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
