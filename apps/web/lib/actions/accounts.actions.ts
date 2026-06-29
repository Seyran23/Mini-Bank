'use server';

import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { Account, AmountActionResult, Currency, LedgerEntry } from '@/lib/types/account';

export async function listAccountsAction(): Promise<Account[]> {
  const accounts = await apiFetch<Account[]>('/accounts');
  return accounts;
}

export async function getAccountAction(accountId: string): Promise<Account> {
  const account = await apiFetch<Account>(`/accounts/${accountId}`);
  return account;
}

export async function createAccountAction(currency: Currency): Promise<Account> {
  const account = await apiFetch<Account>('/accounts', {
    method: 'POST',
    body: JSON.stringify({ currency }),
  });
  return account;
}

export async function depositAction(
  accountId: string,
  amount: string,
  description?: string,
): Promise<AmountActionResult> {
  try {
    const account = await apiFetch<Account>(`/accounts/${accountId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
    return { account };
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.message };
    }
    throw err;
  }
}

export async function withdrawAction(
  accountId: string,
  amount: string,
  description?: string,
): Promise<AmountActionResult> {
  try {
    const account = await apiFetch<Account>(`/accounts/${accountId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
    return { account };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error:
          err.code === 'INSUFFICIENT_FUNDS'
            ? 'Insufficient funds for this withdrawal'
            : err.message,
      };
    }
    throw err;
  }
}

export async function closeAccountAction(accountId: string): Promise<string> {
  const result = await apiFetch<string>(`/accounts/${accountId}`, {
    method: 'DELETE',
    parseAs: 'text',
  });
  return result;
}

export async function getLedgerAction(accountId: string): Promise<LedgerEntry[]> {
  const entries = await apiFetch<LedgerEntry[]>(`/accounts/${accountId}/ledger`);
  return entries;
}
