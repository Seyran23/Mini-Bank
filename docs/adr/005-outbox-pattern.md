# ADR-005: Transactional outbox for publishing transfer events

**Status:** Accepted
**Date:** 2026-06-24

## Context

When a transfer reaches a terminal outcome (`COMPLETED`, `FAILED`, or
`COMPENSATED`), something downstream eventually needs to find out — the
Notifications service (`PROJECT_BRIEF.md`, Week 4) consumes exactly this kind
of event to send a confirmation or failure email. `PROJECT_BRIEF.md` states
inter-service events flow over RabbitMQ.

The naive way to do this — update the `Transfer` row, then call
`channel.publish()` — has a gap with no good resolution on its own:

```
commit DB write → process crashes → publish() never runs → event lost forever
publish() → process crashes before commit → event sent for a state that never committed
```

Either ordering has a window where "the database says X happened" and "the
rest of the system was told X happened" can disagree, with no way to tell
after the fact which one is wrong.

## Decision

An `OutboxEvent` table (`outbox_events`) records events to be published,
written **in the same Postgres transaction** as the saga-state change that
produced them.
`TransfersRepository.advanceSagaStateWithOutboxEvent` is the _only_ method
that performs both writes — it wraps the `Transfer.sagaState` update and the
`OutboxEvent` insert in one `prisma.$transaction()`, so they are atomically
both-or-neither. Outbox rows are only written at the three terminal
transitions; intermediate ones (`DEBIT_PENDING`'s claim, `COMPENSATING`) use
the plain `advanceSagaState`, since nothing outside this service needs to
know about a saga that's still mid-flight.

A second, independent poller, `OutBoxPublisher`
(`@Interval(OUTBOX_POLL_INTERVAL_MS)`), reads rows where `publishedAt IS
NULL`, calls `RabbitMQService.publish(eventType, payload)` for each, and
marks the row published immediately after — per row, not as a batch, so one
failing publish doesn't block the rest.

Both terminal-failure cases (`FAILED` — debit itself never succeeded;
`COMPENSATED` — credit failed, debit was reversed) publish the _same_ event
type, `transfer.failed`, reusing `@minibank/types`'s existing
`TransferFailedEvent` shape with a different `reason` string, rather than
introducing a third event type just to distinguish two flavors of "this
transfer didn't go through."

## Alternatives Considered

**Publish, then commit**: Rejected. If the commit subsequently fails or
rolls back, an event has already gone out announcing a state change that,
as far as the database is concerned, never happened.

**Commit, then publish, with no outbox table** (the naive ordering above):
Rejected — this is the exact dual-write problem this ADR exists to solve. A
crash between the two lines silently loses the event with no record that
anything was ever supposed to be published.

**Change Data Capture (e.g. Debezium reading the Postgres replication log)**:
Rejected for this project's current scale. It's a legitimate, more
"automatic" solution to the same problem, but it means running and
operating a separate CDC pipeline — a real piece of infrastructure beyond
what a single service with a handful of event types needs. The
transactional-outbox-plus-poller pattern gets the same atomicity guarantee
using only Postgres and RabbitMQ, both of which this project already runs.

**Two-phase commit between Postgres and RabbitMQ**: Rejected. `amqplib` has
no practical 2PC support, and even if it did, holding a Postgres transaction
open across a network round-trip to the broker would tie up a database
connection for an unpredictable amount of time per request.

## Consequences

**Positive:**

- The atomicity guarantee is directly tested, not just assumed —
  `transfers.repository.spec.ts`'s "rolls back the sagaState change if the
  outbox insert fails" test forces the transaction to fail and asserts
  neither write landed.
- The saga runner and the outbox publisher are two independent pollers with
  non-overlapping jobs — RabbitMQ being briefly unreachable stalls only
  outbox publishing, not saga progression, and vice versa.
- No new shared event type was needed — `FAILED` and `COMPENSATED` both
  reuse `TransferFailedEvent`, distinguished only by `reason` text.

**Negative:**

- Delivery is at-least-once, not exactly-once: if the process crashes
  between `RabbitMQService.publish()` succeeding and
  `markOutboxEventPublished()` committing, the same event is published again
  on the next tick. Whoever consumes these events (Notifications, Week 4)
  must be idempotent on `eventId` — not yet a problem today since nothing
  consumes them yet, but a real constraint on that future service.
- Published `OutboxEvent` rows are never deleted — harmless at this
  project's volume, but unbounded growth at scale.
- Two extra polling loops touching the database on fixed intervals
  (`SAGA_POLL_INTERVAL_MS`, `OUTBOX_POLL_INTERVAL_MS`), beyond what a
  synchronous request/response design would need — an accepted cost for the
  durability guarantee.

**At higher scale we would consider:**

- Periodic cleanup/archival of old, published `OutboxEvent` rows once a
  consumer pipeline exists to confirm they've actually been processed.
- Publishing unpublished rows in a batch per poll tick instead of one at a
  time, if outbox volume ever makes per-row RabbitMQ round-trips a
  bottleneck.
- Revisiting Change Data Capture at the point where running that
  infrastructure is justified by actual throughput, rather than upfront.
