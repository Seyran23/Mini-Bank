import { Injectable, OnModuleInit } from '@nestjs/common';

import { createLogger } from '@minibank/logger';
import type { TransferCompletedEvent, TransferFailedEvent } from '@minibank/types';

import { AuthClientService } from '@/auth-client/auth-client.service';
import { EmailSender } from '@/email/email-sender.service';
import { RabbitMQService } from '@/rabbitmq/rabbitmq.service';
import { EventDedupService } from '@/redis/event-dedup.service';

type TransferEvent = TransferCompletedEvent | TransferFailedEvent;

@Injectable()
export class TransferEventsConsumer implements OnModuleInit {
  private readonly logger = createLogger('notifications');

  constructor(
    private readonly rabbitMQ: RabbitMQService,
    private readonly dedup: EventDedupService,
    private readonly authClient: AuthClientService,
    private readonly emailSender: EmailSender,
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

    const email = this.buildEmail(event);
    if (!email) {
      this.logger.warn({ eventId, correlationId, type: event.type }, 'Unrecognized event type');
      return;
    }

    const user = await this.authClient.getUser(event.payload.userId);

    await this.emailSender.send(user.email, email.subject, email.body);

    await this.dedup.markProcessed(eventId);

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
