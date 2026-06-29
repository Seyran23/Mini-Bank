import { Inject, Injectable } from '@nestjs/common';

import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@minibank/errors';
import { createLogger } from '@minibank/logger';

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
  private readonly logger = createLogger('transfers');

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
      this.logger.warn({ accountId, correlationId }, 'getAccount rejected: not the owner');
      throw new ForbiddenException('You are not the owner of this account!');
    }
    if (res.status === 404) {
      this.logger.warn({ accountId, correlationId }, 'getAccount rejected: account not found');
      throw new NotFoundException('Account', accountId);
    }
    if (!res.ok) {
      this.logger.error(
        { accountId, correlationId, status: res.status },
        'getAccount call to Accounts failed',
      );
      throw new ServiceUnavailableException('Accounts');
    }

    return (await res.json()) as AccountSnapshot;
  }

  transferDebit(
    accountId: string,
    transferId: string,
    amount: string,
    currency: Currency,
    correlationId: string,
    description?: string,
  ): Promise<LedgerEntrySnapshot> {
    return this.callInternalEndpoint(
      `/accounts/${accountId}/internal/transfer-debit`,
      transferId,
      amount,
      currency,
      correlationId,
      description,
    );
  }

  transferCredit(
    accountId: string,
    transferId: string,
    amount: string,
    currency: Currency,
    correlationId: string,
    description?: string,
  ): Promise<LedgerEntrySnapshot> {
    return this.callInternalEndpoint(
      `/accounts/${accountId}/internal/transfer-credit`,
      transferId,
      amount,
      currency,
      correlationId,
      description,
    );
  }

  reversal(
    accountId: string,
    transferId: string,
    amount: string,
    currency: Currency,
    correlationId: string,
    description?: string,
  ): Promise<LedgerEntrySnapshot> {
    return this.callInternalEndpoint(
      `/accounts/${accountId}/internal/reversal`,
      transferId,
      amount,
      currency,
      correlationId,
      description,
    );
  }

  // No ownership check on the Accounts side — used to look up currency
  // (and existence) of an account the caller doesn't necessarily own, e.g.
  // a transfer's destination account, which may belong to a different user.
  async getAccountInternal(accountId: string, correlationId: string): Promise<AccountSnapshot> {
    const res = await this.request(`/accounts/${accountId}/internal`, {
      method: 'GET',
      headers: {
        'X-Internal-Api-Key': this.config.ACCOUNTS_INTERNAL_API_KEY,
        'x-correlation-id': correlationId,
      },
    });

    if (res.status === 404) {
      this.logger.warn({ accountId, correlationId }, 'getAccountInternal: account not found');
      throw new NotFoundException('Account', accountId);
    }
    if (!res.ok) {
      this.logger.error(
        { accountId, correlationId, status: res.status },
        'getAccountInternal call to Accounts failed',
      );
      throw new ServiceUnavailableException('Accounts');
    }

    return (await res.json()) as AccountSnapshot;
  }

  private async callInternalEndpoint(
    path: string,
    transferId: string,
    amount: string,
    currency: Currency,
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
      body: JSON.stringify({ transferId, amount, currency, description }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        { path, transferId, correlationId, status: res.status },
        'Internal call to Accounts failed',
      );
      throw new Error(`Accounts request to ${path} failed with ${res.status}: ${body}`);
    }

    return (await res.json()) as LedgerEntrySnapshot;
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${this.config.ACCOUNTS_SERVICE_URL}${path}`, init);
  }
}
