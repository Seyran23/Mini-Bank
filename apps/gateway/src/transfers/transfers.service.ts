import { Inject, Injectable } from '@nestjs/common';

import { ServiceUnavailableException } from '@minibank/errors';
import { createLogger } from '@minibank/logger';

import type { ProxiedResponse } from '@/common/types/proxied-response';
import { GATEWAY_CONFIG, type GatewayConfig } from '@/config/gateway.config';

@Injectable()
export class TransfersService {
  private readonly logger = createLogger('gateway');

  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  createTransfer(
    body: unknown,
    accessToken: string,
    correlationId: string,
    idempotencyKey: string | undefined,
  ): Promise<ProxiedResponse> {
    return this.forward('/transfers', 'POST', accessToken, correlationId, body, idempotencyKey);
  }

  listTransfers(accessToken: string, correlationId: string): Promise<ProxiedResponse> {
    return this.forward('/transfers', 'GET', accessToken, correlationId);
  }

  getTransfer(
    transferId: string,
    accessToken: string,
    correlationId: string,
  ): Promise<ProxiedResponse> {
    return this.forward(`/transfers/${transferId}`, 'GET', accessToken, correlationId);
  }

  private async forward(
    path: string,
    method: string,
    accessToken: string,
    correlationId: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<ProxiedResponse> {
    let res: Response;
    try {
      res = await fetch(`${this.config.TRANSFERS_SERVICE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-correlation-id': correlationId,
          ...(idempotencyKey && { 'idempotency-key': idempotencyKey }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
    } catch (err) {
      this.logger.error(
        { path, correlationId, err: err instanceof Error ? err.message : String(err) },
        'Call to Transfers service failed',
      );
      throw new ServiceUnavailableException('Transfers');
    }

    const responseBody = await res.json().catch(() => undefined);
    return { status: res.status, body: responseBody };
  }
}
