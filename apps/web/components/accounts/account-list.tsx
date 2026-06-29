import { Landmark } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import type { Account } from '@/lib/types/account';

import { AccountCard } from './account-card';

export function AccountList({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Landmark className="size-5" />
          </div>
        }
        message="You don't have any accounts yet."
        action={<Button render={<Link href="/accounts/new" />}>Open an account</Button>}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}
