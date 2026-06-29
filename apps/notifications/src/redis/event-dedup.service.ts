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

  async incrementAttempts(eventId: string): Promise<number> {
    const key = this.attemptsKey(eventId);
    const count = await this.redis.getClient().incr(key);
    if (count === 1) {
      await this.redis.getClient().expire(key, TTL_SECONDS);
    }
    return count;
  }

  private key(eventId: string): string {
    return `notif:event:${eventId}`;
  }

  private attemptsKey(eventId: string): string {
    return `notif:event:${eventId}:attempts`;
  }
}
