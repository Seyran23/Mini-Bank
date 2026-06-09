import { Currency } from './currency';

export interface BaseEvent {
  eventId: string;
  occurredAt: string; // ISO 8601
  correlationId: string;
}

export interface UserRegisteredEvent extends BaseEvent {
  type: 'user.registered';
  payload: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface TransferCompletedEvent extends BaseEvent {
  type: 'transfer.completed';
  payload: {
    transferId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: string; // Decimal serialised as string — never send raw numbers over the wire
    currency: Currency;
    userId: string;
  };
}

export interface TransferFailedEvent extends BaseEvent {
  type: 'transfer.failed';
  payload: {
    transferId: string;
    reason: string;
    userId: string;
  };
}

export type DomainEvent = UserRegisteredEvent | TransferCompletedEvent | TransferFailedEvent;
