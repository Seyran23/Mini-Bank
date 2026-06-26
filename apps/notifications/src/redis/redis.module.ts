import { Global, Module } from '@nestjs/common';

import { EventDedupService } from './event-dedup.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, EventDedupService],
  exports: [RedisService, EventDedupService],
})
export class RedisModule {}
