import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

import { createLogger } from '@minibank/logger';

import { TRANSFERS_CONFIG, type TransfersConfig } from '@/config/transfers.config';

const EVENTS_EXCHANGE = 'minibank.events';
const DEAD_LETTER_EXCHANGE = 'minibank.events.dlx';
const DEAD_LETTER_QUEUE = 'minibank.events.dlq';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('transfers');
  private connection!: amqp.ChannelModel;
  private channel!: amqp.Channel;

  constructor(@Inject(TRANSFERS_CONFIG) private readonly config: TransfersConfig) {}

  async onModuleInit(): Promise<void> {
    this.connection = await amqp.connect(this.config.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });

    await this.channel.assertExchange(DEAD_LETTER_EXCHANGE, 'fanout', { durable: true });
    await this.channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await this.channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, '');

    this.logger.info('Connected to RabbitMQ and asserted the events topology');
  }

  publish(routingKey: string, payload: unknown): boolean {
    const content = Buffer.from(JSON.stringify(payload));
    return this.channel.publish(EVENTS_EXCHANGE, routingKey, content, { persistent: true });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
