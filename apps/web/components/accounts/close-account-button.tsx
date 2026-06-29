'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { closeAccountAction } from '@/lib/actions/accounts.actions';

export function CloseAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);

  async function handleClose() {
    setIsClosing(true);
    try {
      await closeAccountAction(accountId);
      toast.success('Account closed');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not close account');
    } finally {
      setIsClosing(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" />}>Close account</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close this account?</AlertDialogTitle>
          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleClose} disabled={isClosing}>
            {isClosing && <Loader2 className="animate-spin" />}
            {isClosing ? 'Closing…' : 'Close account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
