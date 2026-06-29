'use server';

import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { CreateTransferPayload, CreateTransferResult, Transfer } from '@/lib/types/transfer';

export async function createTransferAction(
  payload: CreateTransferPayload,
  idempotencyKey: string,
): Promise<CreateTransferResult> {
  try {
    const transfer = await apiFetch<Transfer>('/transfers', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    });
    return { transfer };
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.message };
    }
    throw err;
  }
}

export async function getTransferAction(transferId: string): Promise<Transfer> {
  const transfer = await apiFetch<Transfer>(`/transfers/${transferId}`);
  return transfer;
}

export async function listTransfersAction(): Promise<Transfer[]> {
  const transfers = await apiFetch<Transfer[]>('/transfers');
  return transfers;
}
