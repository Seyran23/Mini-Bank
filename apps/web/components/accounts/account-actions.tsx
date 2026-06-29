'use client';

import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { depositAction, withdrawAction } from '@/lib/actions/accounts.actions';

import { AmountDialogForm } from './amount-dialog-form';
import { CloseAccountButton } from './close-account-button';

export function AccountActions({ accountId }: { accountId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <AmountDialogForm
        accountId={accountId}
        title="Deposit"
        submitLabel="Deposit"
        onSubmitAmount={depositAction}
        trigger={
          <Button>
            <ArrowDownToLine className="size-4" />
            Deposit
          </Button>
        }
      />
      <AmountDialogForm
        accountId={accountId}
        title="Withdraw"
        submitLabel="Withdraw"
        onSubmitAmount={withdrawAction}
        trigger={
          <Button variant="outline">
            <ArrowUpFromLine className="size-4" />
            Withdraw
          </Button>
        }
      />
      <CloseAccountButton accountId={accountId} />
    </div>
  );
}
