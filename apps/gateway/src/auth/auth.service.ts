import { Inject, Injectable } from '@nestjs/common';

import { ServiceUnavailableException } from '@minibank/errors';
import { createLogger } from '@minibank/logger';

import type { ProxiedResponse } from '@/common/types/proxied-response';
import { GATEWAY_CONFIG, type GatewayConfig } from '@/config/gateway.config';

@Injectable()
export class AuthService {
  private readonly logger = createLogger('gateway');

  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  register(body: unknown, correlationId: string): Promise<ProxiedResponse> {
    return this.forward('/auth/register', 'POST', body, correlationId);
  }

  login(body: unknown, correlationId: string): Promise<ProxiedResponse> {
    return this.forward('/auth/login', 'POST', body, correlationId);
  }

  refresh(body: unknown, correlationId: string): Promise<ProxiedResponse> {
    return this.forward('/auth/refresh', 'POST', body, correlationId);
  }

  logout(body: unknown, correlationId: string): Promise<ProxiedResponse> {
    return this.forward('/auth/logout', 'POST', body, correlationId);
  }

  private async forward(
    path: string,
    method: string,
    body: unknown,
    correlationId: string,
  ): Promise<ProxiedResponse> {
    let res: Response;
    try {
      res = await fetch(`${this.config.AUTH_SERVICE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(
        { path, correlationId, err: err instanceof Error ? err.message : String(err) },
        'Call to Auth service failed',
      );
      throw new ServiceUnavailableException('Auth');
    }

    const responseBody = await res.json().catch(() => undefined);
    return { status: res.status, body: responseBody };
  }
}
