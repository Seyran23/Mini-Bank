'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTransferAction } from '@/lib/actions/transfers.actions';
import type { Account } from '@/lib/types/account';
import { CreateTransferInput, CreateTransferSchema } from '@/lib/validation/transfer.schemas';

interface LastAttempt {
  key: string;
  values: CreateTransferInput;
}

export function TransferForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const lastAttemptRef = useRef<LastAttempt | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTransferInput>({
    resolver: zodResolver(CreateTransferSchema),
    defaultValues: { fromAccountId: accounts[0]?.id ?? '' },
  });

  async function onSubmit(values: CreateTransferInput) {
    const fromAccount = accounts.find((account) => account.id === values.fromAccountId);
    if (!fromAccount) {
      toast.error('Select a valid source account');
      return;
    }

    const isRetryOfSameAttempt =
      lastAttemptRef.current !== null &&
      JSON.stringify(lastAttemptRef.current.values) === JSON.stringify(values);
    const idempotencyKey = isRetryOfSameAttempt ? lastAttemptRef.current!.key : crypto.randomUUID();
    lastAttemptRef.current = { key: idempotencyKey, values };

    const result = await createTransferAction(
      {
        fromAccountId: values.fromAccountId,
        toAccountId: values.toAccountId,
        amount: values.amount,
        currency: fromAccount.currency,
        description: values.description,
      },
      idempotencyKey,
    );

    if ('error' in result) {
      toast.error(result.error);
      return;
    }

    router.push(`/transfers/${result.transfer.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fromAccountId">From account</Label>
        <Controller
          control={control}
          name="fromAccountId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="fromAccountId" className="w-full">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.currency} — {account.balance}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.fromAccountId && (
          <p className="text-sm text-destructive">{errors.fromAccountId.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="toAccountId">To account ID</Label>
        <Input
          id="toAccountId"
          placeholder="Recipient's account UUID"
          {...register('toAccountId')}
        />
        {errors.toAccountId && (
          <p className="text-sm text-destructive">{errors.toAccountId.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" inputMode="decimal" placeholder="0.00" {...register('amount')} />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" {...register('description')} />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? 'Transfer initiated…' : 'Send transfer'}
      </Button>
    </form>
  );
}
