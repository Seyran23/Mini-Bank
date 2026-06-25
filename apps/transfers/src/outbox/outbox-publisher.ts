import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { createLogger } from '@minibank/logger';

import { transfersConfig } from '@/config/transfers.config';
import { RabbitMQService } from '@/rabbitmq/rabbitmq.service';
import { TransfersRepository } from '@/transfers/transfers.repository';

@Injectable()
export class OutBoxPublisher {
  private readonly logger = createLogger('transfers');

  constructor(
    private readonly repo: TransfersRepository,
    private readonly rabbitMQ: RabbitMQService,
  ) {}

  @Interval(Number(transfersConfig.OUTBOX_POLL_INTERVAL_MS))
  async publishOutbox() {
    const events = await this.repo.findUnpublishedOutboxEvents();

    for (const event of events) {
      try {
        this.rabbitMQ.publish(event.eventType, event.payload);
        await this.repo.markOutboxEventPublished(event.id);
      } catch (e) {
        this.logger.error({ err: e, outboxEventId: event.id }, 'Failed to publish outbox event');
      }
    }
  }
}
