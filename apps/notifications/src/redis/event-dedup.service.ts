import { Injectable } from '@nestjs/common';

import { RedisService } from './redis.service';

const TTL_SECONDS = 86_400;

@Injectable()
export class EventDedupService {
  constructor(private readonly redis: RedisService) {}

  async isProcessed(eventId: string): Promise<boolean> {
    const exists = await this.redis.getClient().exists(this.key(eventId));
    return exists === 1;
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.redis.getClient().set(this.key(eventId), '1', 'EX', TTL_SECONDS);
  }

  private key(eventId: string): string {
    return `notif:event:${eventId}`;
  }
}
