'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { getTransferAction } from '@/lib/actions/transfers.actions';
import type { Transfer } from '@/lib/types/transfer';
import { isTransferTerminal, transferStatusVariant } from '@/lib/utils/status';

import { TRANSFER_STATUS_COPY } from './transfer-status.constants';

function friendlyFailureReason(raw: string | null): string {
  const fallback = 'This transfer could not be completed.';
  if (!raw) {
    return fallback;
  }

  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw.slice(jsonStart)) as { message?: string };
    return parsed.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function TransferStatusView({
  transferId,
  initialData,
}: {
  transferId: string;
  initialData: Transfer;
}) {
  const { data, isError } = useQuery({
    queryKey: ['transfer', transferId],
    queryFn: () => getTransferAction(transferId),
    initialData,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isTransferTerminal(status) ? false : 1500;
    },
  });

  if (isError || !data) {
    return <p className="text-sm text-destructive">Could not load this transfer.</p>;
  }

  const isComplete = data.status === 'COMPLETED';
  const isTerminalFailure = data.status === 'COMPENSATED' || data.status === 'FAILED';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {isComplete && <CheckCircle2 className="size-5 text-primary" />}
        {isTerminalFailure && <XCircle className="size-5 text-destructive" />}
        {!isComplete && !isTerminalFailure && (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
        <Badge variant={transferStatusVariant(data.status)}>{data.status}</Badge>
      </div>

      <p className="text-sm text-muted-foreground">{TRANSFER_STATUS_COPY[data.status]}</p>

      {isTerminalFailure && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {friendlyFailureReason(data.failureReason)}
        </p>
      )}
    </div>
  );
}
