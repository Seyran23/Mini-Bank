import { Inject, Injectable } from '@nestjs/common';

import { ServiceUnavailableException } from '@minibank/errors';
import { createLogger } from '@minibank/logger';

import type { ProxiedResponse } from '@/common/types/proxied-response';
import { GATEWAY_CONFIG, type GatewayConfig } from '@/config/gateway.config';

@Injectable()
export class AccountsService {
  private readonly logger = createLogger('gateway');

  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  createAccount(
    body: unknown,
    accessToken: string,
    correlationId: string,
  ): Promise<ProxiedResponse> {
    return this.forward('/accounts', 'POST', accessToken, correlationId, body);
  }

  listAccounts(accessToken: string, correlationId: string): Promise<ProxiedResponse> {
    return this.forward('/accounts', 'GET', accessToken, correlationId);
  }

  getAccount(
    accountId: string,
    accessToken: string,
    correlationId: string,
  ): Promise<ProxiedResponse> {
    return this.forward(`/accounts/${accountId}`, 'GET', accessToken, correlationId);
  }

  closeAccount(
    accountId: string,
    accessToken: string,
    correlationId: string,
  ): Promise<ProxiedResponse> {
    return this.forward(`/accounts/${accountId}`, 'DELETE', accessToken, correlationId);
  }

  getLedger(
    accountId: string,
    accessToken: string,
    correlationId: string,
  ): Promise<ProxiedResponse> {
    return this.forward(`/accounts/${accountId}/ledger`, 'GET', accessToken, correlationId);
  }

  deposit(
    accountId: string,
    body: unknown,
    accessToken: string,
    correlationId: string,
  ): Promise<ProxiedResponse> {
    return this.forward(`/accounts/${accountId}/deposit`, 'POST', accessToken, correlationId, body);
  }

  withdraw(
    accountId: string,
    body: unknown,
    accessToken: string,
    correlationId: string,
  ): Promise<ProxiedResponse> {
    return this.forward(
      `/accounts/${accountId}/withdraw`,
      'POST',
      accessToken,
      correlationId,
      body,
    );
  }

  private async forward(
    path: string,
    method: string,
    accessToken: string,
    correlationId: string,
    body?: unknown,
  ): Promise<ProxiedResponse> {
    let res: Response;
    try {
      res = await fetch(`${this.config.ACCOUNTS_SERVICE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-correlation-id': correlationId,
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
    } catch (err) {
      this.logger.error(
        { path, correlationId, err: err instanceof Error ? err.message : String(err) },
        'Call to Accounts service failed',
      );
      throw new ServiceUnavailableException('Accounts');
    }

    const responseBody = await res.json().catch(() => undefined);
    return { status: res.status, body: responseBody };
  }
}
