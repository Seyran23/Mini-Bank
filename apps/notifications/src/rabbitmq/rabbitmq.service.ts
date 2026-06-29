import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

import { createLogger } from '@minibank/logger';

import { NOTIFICATIONS_CONFIG, type NotificationsConfig } from '@/config/notifications.config';

import { PermanentFailureError } from './permanent-failure.error';

const EVENTS_EXCHANGE = 'minibank.events';
const DEAD_LETTER_EXCHANGE = 'minibank.events.dlx';
const DEAD_LETTER_QUEUE = 'minibank.events.dlq';
const NOTIFICATIONS_QUEUE = 'notifications.events.queue';
const PREFETCH = 10;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('notifications');
  private connection!: amqp.ChannelModel;
  private channel!: amqp.Channel;

  constructor(@Inject(NOTIFICATIONS_CONFIG) private readonly config: NotificationsConfig) {}

  async onModuleInit(): Promise<void> {
    this.connection = await amqp.connect(this.config.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });

    await this.channel.assertExchange(DEAD_LETTER_EXCHANGE, 'fanout', { durable: true });
    await this.channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await this.channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, '');

    await this.channel.assertQueue(NOTIFICATIONS_QUEUE, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE },
    });

    await this.channel.bindQueue(NOTIFICATIONS_QUEUE, EVENTS_EXCHANGE, 'transfer.*');

    await this.channel.prefetch(PREFETCH);

    this.logger.info('Connected to RabbitMQ and asserted the events topology');
  }

  async consume(handler: (payload: unknown) => Promise<void>): Promise<void> {
    await this.channel.consume(NOTIFICATIONS_QUEUE, async (msg) => {
      if (!msg) {
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(msg.content.toString());
      } catch (err) {
        this.logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Malformed message payload, dead-lettering without requeue',
        );
        this.channel.nack(msg, false, false);
        return;
      }

      try {
        await handler(payload);
        this.channel.ack(msg);
      } catch (err) {
        if (err instanceof PermanentFailureError) {
          this.logger.error(
            { err: err.message },
            'Handler gave up on this message permanently, dead-lettering without requeue',
          );
          this.channel.nack(msg, false, false);
          return;
        }

        this.logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'Handler failed, requeueing message',
        );
        this.channel.nack(msg, false, true);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
