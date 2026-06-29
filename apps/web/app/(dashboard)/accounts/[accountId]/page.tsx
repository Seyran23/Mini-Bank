import { notFound } from 'next/navigation';

import { AccountActions } from '@/components/accounts/account-actions';
import { CopyAccountId } from '@/components/accounts/copy-account-id';
import { LedgerTable } from '@/components/accounts/ledger-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAccountAction } from '@/lib/actions/accounts.actions';
import { ApiError } from '@/lib/api/errors';
import { formatCurrency } from '@/lib/utils/format';
import { accountStatusVariant } from '@/lib/utils/status';

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  let account;
  try {
    account = await getAccountAction(accountId);
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{account.currency} account</CardTitle>
          <Badge variant={accountStatusVariant(account.status)}>{account.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-semibold">
            {formatCurrency(account.balance, account.currency)}
          </p>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Share this account ID with someone to receive a transfer
            </p>
            <CopyAccountId accountId={account.id} />
          </div>
          {account.status === 'ACTIVE' && <AccountActions accountId={account.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
        </CardHeader>
        <CardContent>
          <LedgerTable accountId={account.id} currency={account.currency} />
        </CardContent>
      </Card>
    </div>
  );
}
