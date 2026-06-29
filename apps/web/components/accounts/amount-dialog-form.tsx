'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ledgerKey } from '@/lib/query/keys';
import type { AmountActionResult } from '@/lib/types/account';
import { AmountInput, AmountSchema } from '@/lib/validation/account.schemas';

interface AmountDialogFormProps {
  accountId: string;
  trigger: React.ReactNode;
  title: string;
  submitLabel: string;
  onSubmitAmount: (
    accountId: string,
    amount: string,
    description?: string,
  ) => Promise<AmountActionResult>;
}

export function AmountDialogForm({
  accountId,
  trigger,
  title,
  submitLabel,
  onSubmitAmount,
}: AmountDialogFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AmountInput>({ resolver: zodResolver(AmountSchema) });

  async function onSubmit(values: AmountInput) {
    const result = await onSubmitAmount(accountId, values.amount, values.description);

    if ('error' in result) {
      setError('amount', { message: result.error });
      return;
    }

    toast.success('Done!');
    setOpen(false);
    reset();
    router.refresh();
    void queryClient.invalidateQueries({ queryKey: ledgerKey(accountId) });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" inputMode="decimal" placeholder="0.00" {...register('amount')} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" {...register('description')} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? 'Submitting…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
