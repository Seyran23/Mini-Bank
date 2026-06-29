import Link from 'next/link';

import { EmptyState } from '@/components/shared/empty-state';
import { TransferForm } from '@/components/transfers/transfer-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listAccountsAction } from '@/lib/actions/accounts.actions';

export default async function NewTransferPage() {
  const accounts = await listAccountsAction();
  const activeAccounts = accounts.filter((account) => account.status === 'ACTIVE');

  if (activeAccounts.length === 0) {
    return (
      <EmptyState
        message="You need an active account before you can send a transfer."
        action={<Button render={<Link href="/accounts/new" />}>Open an account</Button>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Send a transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <TransferForm accounts={activeAccounts} />
        </CardContent>
      </Card>
    </div>
  );
}
