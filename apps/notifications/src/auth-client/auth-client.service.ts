import { Inject, Injectable } from '@nestjs/common';

import { NotFoundException, ServiceUnavailableException } from '@minibank/errors';
import { createLogger } from '@minibank/logger';

import { NOTIFICATIONS_CONFIG, type NotificationsConfig } from '@/config/notifications.config';

export interface UserSnapshot {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

@Injectable()
export class AuthClientService {
  private readonly logger = createLogger('notifications');

  constructor(@Inject(NOTIFICATIONS_CONFIG) private readonly config: NotificationsConfig) {}

  async getUser(userId: string): Promise<UserSnapshot> {
    const res = await this.request(`/auth/internal/users/${userId}`, {
      method: 'GET',
      headers: {
        'x-internal-api-key': this.config.AUTH_INTERNAL_API_KEY,
      },
    });

    if (res.status === 404) {
      this.logger.warn({ userId }, 'getUser rejected: user not found');
      throw new NotFoundException('User', userId);
    }

    if (!res.ok) {
      this.logger.error({ userId, status: res.status }, 'getUser call to Auth failed');
      throw new ServiceUnavailableException('Users');
    }

    return (await res.json()) as UserSnapshot;
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${this.config.AUTH_SERVICE_URL}${path}`, init);
  }
}
