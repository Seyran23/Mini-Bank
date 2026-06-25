import { Inject, Injectable } from '@nestjs/common';

import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@minibank/errors';

import { TRANSFERS_CONFIG, type TransfersConfig } from '@/config/transfers.config';
import { Currency } from '@/generated/prisma';

export interface AccountSnapshot {
  id: string;
  userId: string;
  currency: Currency;
  status: 'ACTIVE' | 'CLOSED';
  balance: string;
}

export interface LedgerEntrySnapshot {
  id: string;
  type: string;
  amount: string;
  description: string | null;
  createdAt: string;
}

@Injectable()
export class AccountsClient {
  constructor(@Inject(TRANSFERS_CONFIG) private readonly config: TransfersConfig) {}

  async getAccount(
    accountId: string,
    accessToken: string,
    correlationId: string,
  ): Promise<AccountSnapshot> {
    const res = await this.request(`/accounts/${accountId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-correlation-id': correlationId,
      },
    });

    if (res.status === 403) {
      throw new ForbiddenException('You are not the owner of this account!');
    }
    if (res.status === 404) {
      throw new NotFoundException('Account', accountId);
    }
    if (!res.ok) {
      throw new ServiceUnavailableException('Accounts');
    }

    return (await res.json()) as AccountSnapshot;
  }

  transferDebit(
    accountId: string,
    transferId: string,
    amount: string,
    correlationId: string,
    description?: string,
  ): Promise<LedgerEntrySnapshot> {
    return this.callInternalEndpoint(
      `/accounts/${accountId}/internal/transfer-debit`,
      transferId,
      amount,
      correlationId,
      description,
    );
  }

  transferCredit(
    accountId: string,
    transferId: string,
    amount: string,
    correlationId: string,
    description?: string,
  ): Promise<LedgerEntrySnapshot> {
    return this.callInternalEndpoint(
      `/accounts/${accountId}/internal/transfer-credit`,
      transferId,
      amount,
      correlationId,
      description,
    );
  }

  reversal(
    accountId: string,
    transferId: string,
    amount: string,
    correlationId: string,
    description?: string,
  ): Promise<LedgerEntrySnapshot> {
    return this.callInternalEndpoint(
      `/accounts/${accountId}/internal/reversal`,
      transferId,
      amount,
      correlationId,
      description,
    );
  }

  private async callInternalEndpoint(
    path: string,
    transferId: string,
    amount: string,
    correlationId: string,
    description?: string,
  ): Promise<LedgerEntrySnapshot> {
    const res = await this.request(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Api-Key': this.config.ACCOUNTS_INTERNAL_API_KEY,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({ transferId, amount, description }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Accounts request to ${path} failed with ${res.status}: ${body}`);
    }

    return (await res.json()) as LedgerEntrySnapshot;
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${this.config.ACCOUNTS_SERVICE_URL}${path}`, init);
  }
}
