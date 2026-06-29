import Link from 'next/link';

import { AccountList } from '@/components/accounts/account-list';
import { Button } from '@/components/ui/button';
import { listAccountsAction } from '@/lib/actions/accounts.actions';

export default async function AccountsPage() {
  const accounts = await listAccountsAction();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Accounts</h1>
        {accounts.length > 0 && <Button render={<Link href="/accounts/new" />}>New account</Button>}
      </div>

      <AccountList accounts={accounts} />
    </div>
  );
}
