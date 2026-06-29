import { Test, TestingModule } from '@nestjs/testing';

import { Currency } from '@minibank/types';

import { AuthClientService } from '@/auth-client/auth-client.service';
import { EmailSender } from '@/email/email-sender.service';
import { PermanentFailureError } from '@/rabbitmq/permanent-failure.error';
import { RabbitMQService } from '@/rabbitmq/rabbitmq.service';
import { EventDedupService } from '@/redis/event-dedup.service';

import { TransferEventsConsumer } from './transfer-events.consumer';

const baseEvent = {
  eventId: 'event-id-1',
  occurredAt: '2024-01-01T00:00:00.000Z',
  correlationId: 'correlation-id-1',
};

const completedEvent = {
  ...baseEvent,
  type: 'transfer.completed' as const,
  payload: {
    transferId: 'transfer-id-1',
    fromAccountId: 'account-id-1',
    toAccountId: 'account-id-2',
    amount: '40.00',
    currency: Currency.USD,
    userId: 'user-id-1',
  },
};

const failedEvent = {
  ...baseEvent,
  type: 'transfer.failed' as const,
  payload: {
    transferId: 'transfer-id-1',
    reason: 'insufficient funds',
    userId: 'user-id-1',
  },
};

const mockUser = {
  id: 'user-id-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Doe',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('TransferEventsConsumer', () => {
  let rabbitMQ: jest.Mocked<RabbitMQService>;
  let dedup: jest.Mocked<EventDedupService>;
  let authClient: jest.Mocked<AuthClientService>;
  let emailSender: jest.Mocked<EmailSender>;
  let handler: (payload: unknown) => Promise<void>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferEventsConsumer,
        { provide: RabbitMQService, useValue: { consume: jest.fn() } },
        {
          provide: EventDedupService,
          useValue: {
            isProcessed: jest.fn(),
            markProcessed: jest.fn(),
            incrementAttempts: jest.fn(),
          },
        },
        { provide: AuthClientService, useValue: { getUser: jest.fn() } },
        { provide: EmailSender, useValue: { send: jest.fn() } },
      ],
    }).compile();

    const consumer = module.get(TransferEventsConsumer);
    rabbitMQ = module.get(RabbitMQService);
    dedup = module.get(EventDedupService);
    authClient = module.get(AuthClientService);
    emailSender = module.get(EmailSender);

    dedup.isProcessed.mockResolvedValue(false);
    dedup.incrementAttempts.mockResolvedValue(1);
    authClient.getUser.mockResolvedValue(mockUser);

    await consumer.onModuleInit();
    handler = rabbitMQ.consume.mock.calls[0]![0];
  });

  afterEach(() => jest.clearAllMocks());

  it('sends an email and marks the event processed for a new transfer.completed event', async () => {
    await handler(completedEvent);

    expect(dedup.isProcessed).toHaveBeenCalledWith('event-id-1');
    expect(authClient.getUser).toHaveBeenCalledWith('user-id-1');
    expect(emailSender.send).toHaveBeenCalledWith(
      'alice@example.com',
      'Your transfer completed',
      expect.stringContaining('40.00 USD'),
    );
    expect(dedup.markProcessed).toHaveBeenCalledWith('event-id-1');
  });

  it('sends an email and marks the event processed for a new transfer.failed event', async () => {
    await handler(failedEvent);

    expect(emailSender.send).toHaveBeenCalledWith(
      'alice@example.com',
      'Your transfer failed',
      expect.stringContaining('insufficient funds'),
    );
    expect(dedup.markProcessed).toHaveBeenCalledWith('event-id-1');
  });

  it('skips already-processed events without looking up a user or sending an email', async () => {
    dedup.isProcessed.mockResolvedValue(true);

    await handler(completedEvent);

    expect(authClient.getUser).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
    expect(dedup.markProcessed).not.toHaveBeenCalled();
  });

  it('does nothing for an unrecognized event type, without throwing', async () => {
    const unknownEvent = { ...baseEvent, type: 'user.registered', payload: {} };

    await expect(handler(unknownEvent)).resolves.toBeUndefined();

    expect(authClient.getUser).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('does not mark the event processed if sending the email fails', async () => {
    emailSender.send.mockRejectedValue(new Error('SMTP unreachable'));

    await expect(handler(completedEvent)).rejects.toThrow('SMTP unreachable');

    expect(dedup.markProcessed).not.toHaveBeenCalled();
  });

  it('does not mark the event processed if the user lookup fails', async () => {
    authClient.getUser.mockRejectedValue(new Error('Auth unreachable'));

    await expect(handler(completedEvent)).rejects.toThrow('Auth unreachable');

    expect(emailSender.send).not.toHaveBeenCalled();
    expect(dedup.markProcessed).not.toHaveBeenCalled();
  });

  it('gives up permanently after too many failed attempts, without retrying the lookup', async () => {
    dedup.incrementAttempts.mockResolvedValue(6);

    await expect(handler(completedEvent)).rejects.toThrow(PermanentFailureError);

    expect(authClient.getUser).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });
});
