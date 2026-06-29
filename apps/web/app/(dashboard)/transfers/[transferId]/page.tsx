import { notFound } from 'next/navigation';

import { TransferStatusView } from '@/components/transfers/transfer-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTransferAction } from '@/lib/actions/transfers.actions';
import { ApiError } from '@/lib/api/errors';

export default async function TransferStatusPage({
  params,
}: {
  params: Promise<{ transferId: string }>;
}) {
  const { transferId } = await params;

  let transfer;
  try {
    transfer = await getTransferAction(transferId);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Transfer status</CardTitle>
        </CardHeader>
        <CardContent>
          <TransferStatusView transferId={transferId} initialData={transfer} />
        </CardContent>
      </Card>
    </div>
  );
}
