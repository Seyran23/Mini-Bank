import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

import { createLogger } from '@minibank/logger';
import type { TransferCompletedEvent, TransferFailedEvent } from '@minibank/types';

import { AuthClientService } from '@/auth-client/auth-client.service';
import { EmailSender } from '@/email/email-sender.service';
import { PermanentFailureError } from '@/rabbitmq/permanent-failure.error';
import { RabbitMQService } from '@/rabbitmq/rabbitmq.service';
import { EventDedupService } from '@/redis/event-dedup.service';

type TransferEvent = TransferCompletedEvent | TransferFailedEvent;

const MAX_ATTEMPTS = 5;

@Injectable()
export class TransferEventsConsumer implements OnModuleInit {
  private readonly logger = createLogger('notifications');

  constructor(
    private readonly rabbitMQ: RabbitMQService,
    private readonly dedup: EventDedupService,
    private readonly authClient: AuthClientService,
    private readonly emailSender: EmailSender,
    @InjectMetric('notifications_events_consumed_total')
    private readonly consumedCounter: Counter<string>,
    @InjectMetric('notifications_events_dead_lettered_total')
    private readonly deadLetteredCounter: Counter<string>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMQ.consume((payload) => this.handle(payload as TransferEvent));
  }

  private async handle(event: TransferEvent): Promise<void> {
    const { eventId, correlationId } = event;

    if (await this.dedup.isProcessed(eventId)) {
      this.logger.info({ eventId, correlationId }, 'Event already processed, skipping');
      return;
    }

    const attempts = await this.dedup.incrementAttempts(eventId);
    if (attempts > MAX_ATTEMPTS) {
      this.deadLetteredCounter.inc({ event_type: event.type });
      throw new PermanentFailureError(
        `Giving up on event ${eventId} after ${attempts - 1} failed attempts`,
      );
    }

    const email = this.buildEmail(event);
    if (!email) {
      this.logger.warn({ eventId, correlationId, type: event.type }, 'Unrecognized event type');
      return;
    }

    const user = await this.authClient.getUser(event.payload.userId);

    await this.emailSender.send(user.email, email.subject, email.body);

    await this.dedup.markProcessed(eventId);
    this.consumedCounter.inc({ event_type: event.type });

    this.logger.info({ eventId, correlationId, to: user.email }, 'Notification email sent');
  }

  private buildEmail(event: TransferEvent): { subject: string; body: string } | null {
    if (event.type === 'transfer.completed') {
      const { amount, currency, transferId } = event.payload;
      return {
        subject: 'Your transfer completed',
        body: `Your transfer of ${amount} ${currency} (ref ${transferId}) has completed successfully.`,
      };
    }

    if (event.type === 'transfer.failed') {
      const { reason, transferId } = event.payload;
      return {
        subject: 'Your transfer failed',
        body: `Your transfer (ref ${transferId}) failed: ${reason}`,
      };
    }

    return null;
  }
}
