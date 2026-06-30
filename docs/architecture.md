# Architecture

## System overview

MiniBank is a microservices banking platform. All HTTP traffic enters through a
single API Gateway. Five backend services own distinct bounded contexts and
communicate via synchronous HTTP (for commands) and RabbitMQ (for events).
Each service has its own PostgreSQL database — no service reads another
service's tables directly.

```mermaid
graph TD
    Browser["Browser / Next.js :3005"]
    GW["API Gateway :3000\nauth verification · rate limiting"]
    Auth["Auth Service :3001\nusers · credentials · tokens"]
    Acc["Accounts Service :3002\naccounts · ledger · balances"]
    Tr["Transfers Service :3003\nsaga orchestrator · outbox"]
    Notif["Notifications Service :3004\nevent consumer · email"]
    MQ["RabbitMQ\ntransfer.completed\ntransfer.failed"]
    AuthDB[("auth_db\nPostgres :5435")]
    AccDB[("accounts_db\nPostgres :5433")]
    TrDB[("transfers_db\nPostgres :5434")]
    Redis[("Redis :6380\nrefresh tokens\notification dedup")]

    Browser -->|HTTP| GW
    GW -->|HTTP| Auth
    GW -->|HTTP| Acc
    GW -->|HTTP| Tr
    Auth --- AuthDB
    Acc --- AccDB
    Tr --- TrDB
    Tr -->|internal HTTP| Acc
    Tr -->|outbox publisher| MQ
    Notif -->|consume| MQ
    Auth --- Redis
    Notif --- Redis
```

---

## Auth flow

Registration stores a user row with an Argon2-hashed password. Login issues
a short-lived RS256 access token (15 min) and a long-lived refresh token
stored in Redis against a device ID.

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as Gateway
    participant A as Auth Service
    participant R as Redis

    C->>GW: POST /auth/login
    GW->>A: forward
    A->>A: verify password (Argon2)
    A->>R: SETEX refresh_token:{deviceId} 7d
    A-->>C: { accessToken, refreshToken }

    Note over C,A: On every subsequent request
    C->>GW: GET /accounts (Bearer accessToken)
    GW->>A: POST /auth/internal/verify
    A->>A: verify RS256 signature
    A-->>GW: { userId }
    GW->>Acc: forward with X-User-Id header
```

Refresh token rotation: on `POST /auth/refresh`, the old token is deleted and
a new pair is issued. If a refresh token is reused (already deleted), the
entire device's token family is invalidated — detecting a stolen token.

---

## Transfer saga

A transfer is a distributed transaction across two accounts that live in the
same Accounts database but are managed by a separate service. There is no
cross-database transaction. Instead, the Transfers service runs a saga with
explicit state and compensation.

### State machine

```mermaid
stateDiagram-v2
    [*] --> INITIATED : POST /transfers
    INITIATED --> DEBIT_PENDING : claim
    DEBIT_PENDING --> DEBIT_COMPLETE : debit OK
    DEBIT_PENDING --> FAILED : debit rejected\n(insufficient funds / currency mismatch)
    DEBIT_COMPLETE --> CREDIT_PENDING : claim
    CREDIT_PENDING --> COMPLETED : credit OK
    CREDIT_PENDING --> COMPENSATING : credit failed
    COMPENSATING --> COMPENSATED : reversal OK
    COMPENSATING --> COMPENSATING : reversal failed\n(retry next tick)
```

Terminal states: `COMPLETED`, `COMPENSATED`, `FAILED`.

The `INITIATED → DEBIT_PENDING` and `DEBIT_COMPLETE → CREDIT_PENDING` transitions
are compare-and-swap (`UPDATE ... WHERE sagaState = ?`). Only one saga runner
instance can win each claim — making horizontal scaling safe by construction.

### Saga runner tick

`TransferSagaRunner` polls every `SAGA_POLL_INTERVAL_MS` (default 2 s) for all
non-terminal transfers and advances each one:

```mermaid
sequenceDiagram
    participant R as SagaRunner (tick)
    participant TDB as transfers_db
    participant A as Accounts Service

    R->>TDB: findNonTerminalTransfers()
    loop each transfer
        alt DEBIT_PENDING
            R->>A: POST /accounts/:id/internal/transfer-debit
            A->>A: SELECT FOR UPDATE (account lock)
            A->>A: check balance, create ledger entry
            A-->>R: 200 OK
            R->>TDB: UPDATE sagaState = DEBIT_COMPLETE
        else CREDIT_PENDING
            R->>A: POST /accounts/:id/internal/transfer-credit
            A-->>R: 200 OK
            R->>TDB: UPDATE sagaState = COMPLETED + INSERT outbox event
        else COMPENSATING
            R->>A: POST /accounts/:id/internal/reversal
            A-->>R: 200 OK
            R->>TDB: UPDATE sagaState = COMPENSATED + INSERT outbox event
        end
    end
```

Every Accounts call is **idempotent**: it deduplicates on
`(accountId, relatedTransactionId, entryType)`. The saga runner is free to
crash and retry any step without risk of double-debit or double-credit.

---

## Outbox pattern

Writing to RabbitMQ in the same database transaction as the saga state change
would be two separate writes to two systems — if the process crashes after one
but before the other, the event is lost or duplicated. The outbox pattern
collapses this into a single Postgres commit.

```mermaid
sequenceDiagram
    participant R as SagaRunner
    participant TDB as transfers_db\n(single transaction)
    participant OP as OutboxPublisher\n(polls every 2 s)
    participant MQ as RabbitMQ

    R->>TDB: BEGIN
    R->>TDB: UPDATE transfers SET sagaState = COMPLETED
    R->>TDB: INSERT INTO outbox (eventType, payload, publishedAt = NULL)
    R->>TDB: COMMIT

    OP->>TDB: SELECT * FROM outbox WHERE publishedAt IS NULL
    OP->>MQ: publish event
    OP->>TDB: UPDATE outbox SET publishedAt = now()
```

If the OutboxPublisher crashes after publishing but before marking the row, it
will re-publish on the next poll. Consumers handle this with Redis-backed
event deduplication (`EventDedupService`).

---

## Notification consumer

The Notifications service consumes `transfer.completed` and `transfer.failed`
events. It retries up to 5 times (tracked in Redis). On the 6th attempt it
throws `PermanentFailureError`, which causes the RabbitMQ consumer to
`nack` without requeue — the message moves to the dead-letter queue.

```mermaid
sequenceDiagram
    participant MQ as RabbitMQ
    participant N as NotificationsService
    participant R as Redis
    participant Auth as Auth Service
    participant Mail as MailHog / SES

    MQ->>N: deliver event
    N->>R: isProcessed(eventId)?
    alt already processed
        N-->>MQ: ack (skip)
    else not processed
        N->>R: incrementAttempts(eventId)
        alt attempts > 5
            N-->>MQ: nack (dead-letter)
        else
            N->>Auth: GET /users/:id (get email)
            N->>Mail: send email
            N->>R: markProcessed(eventId)
            N-->>MQ: ack
        end
    end
```

---

## Concurrency — ledger locking

Every balance-changing operation in the Accounts service acquires a
Postgres advisory lock on the account ID before reading or writing the ledger.
This prevents two concurrent withdrawals both seeing a sufficient balance and
both succeeding.

```mermaid
sequenceDiagram
    participant W1 as Withdraw (request 1)
    participant W2 as Withdraw (request 2)
    participant DB as accounts_db

    W1->>DB: SELECT pg_advisory_xact_lock(accountId)
    Note over DB: W1 holds lock
    W2->>DB: SELECT pg_advisory_xact_lock(accountId)
    Note over DB: W2 blocks
    W1->>DB: SELECT SUM(amount) — balance = 100
    W1->>DB: INSERT ledger_entry amount = -100
    W1->>DB: COMMIT (lock released)
    Note over DB: W2 unblocks
    W2->>DB: SELECT SUM(amount) — balance = 0
    W2-->>W2: throw InsufficientFundsException
```

---

## Data models

### Auth service

```
users
  id          uuid PK
  email       text UNIQUE
  password    text          -- Argon2 hash
  created_at  timestamptz

refresh_tokens
  id          uuid PK
  user_id     uuid FK → users
  device_id   text
  token_hash  text UNIQUE
  expires_at  timestamptz
  revoked_at  timestamptz
```

### Accounts service

```
accounts
  id          uuid PK
  user_id     uuid          -- denormalized, no FK to auth_db
  currency    enum(USD,EUR,GBP)
  status      enum(ACTIVE,CLOSED)
  created_at  timestamptz

ledger_entries
  id                      uuid PK
  account_id              uuid FK → accounts
  amount                  decimal(20,8)  -- negative for debits
  type                    enum(DEPOSIT,WITHDRAWAL,TRANSFER_DEBIT,
                               TRANSFER_CREDIT,REVERSAL)
  related_transaction_id  uuid           -- transfer ID for idempotency
  description             text
  created_at              timestamptz
```

Balance = `SELECT SUM(amount) FROM ledger_entries WHERE account_id = ?`.
The table is append-only — rows are never updated or deleted.

### Transfers service

```
transfers
  id              uuid PK
  user_id         uuid
  from_account_id uuid
  to_account_id   uuid
  amount          decimal(20,8)
  currency        enum(USD,EUR,GBP)
  saga_state      enum(INITIATED,DEBIT_PENDING,DEBIT_COMPLETE,
                       CREDIT_PENDING,COMPLETED,COMPENSATING,
                       COMPENSATED,FAILED)
  failure_reason  text
  correlation_id  uuid
  created_at      timestamptz
  updated_at      timestamptz

outbox
  id            uuid PK
  event_type    text
  payload       jsonb
  published_at  timestamptz   -- NULL until published
  created_at    timestamptz
```

---

## Observability

All 5 backend services expose `GET /metrics` in Prometheus text format.
Prometheus scrapes every 15 seconds. Grafana is pre-provisioned with a
MiniBank Overview dashboard.

| Metric                                     | Type      | Labels                      |
| ------------------------------------------ | --------- | --------------------------- |
| `http_requests_total`                      | Counter   | `job, method, path, status` |
| `http_request_duration_seconds`            | Histogram | `job, method, path, status` |
| `db_query_duration_seconds`                | Histogram | `job`                       |
| `db_slow_queries_total`                    | Counter   | `job`                       |
| `db_failed_queries_total`                  | Counter   | `job`                       |
| `db_connections_active`                    | Gauge     | `job`                       |
| `db_transaction_duration_seconds`          | Histogram | `job`                       |
| `auth_registrations_total`                 | Counter   | —                           |
| `auth_logins_total`                        | Counter   | `result`                    |
| `accounts_deposits_total`                  | Counter   | `currency`                  |
| `accounts_withdrawals_total`               | Counter   | `currency`                  |
| `transfers_total`                          | Counter   | `result`                    |
| `transfers_amount`                         | Histogram | `currency`                  |
| `transfers_in_flight`                      | Gauge     | `state`                     |
| `notifications_events_consumed_total`      | Counter   | `event_type`                |
| `notifications_events_dead_lettered_total` | Counter   | `event_type`                |

Seven alerting rules fire to Prometheus Alertmanager (configurable):
login failure rate, transfer failure rate, saga stuck detection,
compensating spike, notification dead-letter spike, slow query spike,
service down.
