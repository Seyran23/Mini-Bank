import Link from 'next/link';

import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listTransfersAction } from '@/lib/actions/transfers.actions';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { transferStatusVariant } from '@/lib/utils/status';

export default async function TransfersPage() {
  const transfers = await listTransfersAction();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Transfers</h1>
        {transfers.length > 0 && (
          <Button render={<Link href="/transfers/new" />}>New transfer</Button>
        )}
      </div>

      {transfers.length === 0 ? (
        <EmptyState
          message="You haven't sent any transfers yet."
          action={<Button render={<Link href="/transfers/new" />}>Send your first transfer</Button>}
        />
      ) : (
        <div className="space-y-2">
          {transfers.map((transfer) => (
            <Link key={transfer.id} href={`/transfers/${transfer.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {formatCurrency(transfer.amount, transfer.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(transfer.createdAt)}
                    </p>
                  </div>
                  <Badge variant={transferStatusVariant(transfer.status)}>{transfer.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
