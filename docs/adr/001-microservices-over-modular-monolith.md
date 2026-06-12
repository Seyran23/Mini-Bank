# ADR-001: Microservices over a modular monolith

**Status:** Accepted
**Date:** 2026-06-12

## Context

MiniBank is a portfolio project meant to demonstrate backend engineering
skills at a strong-junior to mid-level: distributed systems patterns, service
boundaries, eventual consistency, message-driven communication (RabbitMQ),
saga orchestration, and per-service data ownership.

The actual feature set — accounts, transfers, notifications — is small enough
that a single Nest.js modular monolith with well-defined module boundaries and
a shared Postgres database would deliver the same user-facing functionality
with far less operational overhead: one deploy target, one database, no
network hops or partial-failure handling between "modules."

`PROJECT_BRIEF.md` states the guiding principle explicitly: "If a feature does
not demonstrate a specific technical skill, it does not go in." The
architecture itself is one of the things being demonstrated, not just the
features built on top of it.

## Decision

Build MiniBank as five independently deployable services (Gateway, Auth,
Accounts, Transactions, Notifications) plus a Next.js frontend:

- Each service owns its own Postgres database, Prisma schema, and
  migrations — no shared databases.
- Services call each other synchronously over REST for commands (e.g.
  Transactions → Accounts to debit/credit).
- Services publish/consume domain events over RabbitMQ for cross-service
  side effects (e.g. Notifications reacting to a completed transfer).
- Cross-cutting state (sessions, idempotency keys, rate limits) lives in
  Redis, not in any one service's database.
- The Transactions service orchestrates multi-service transfers via a saga
  with an outbox pattern, since a transfer touches two accounts that may
  live in different databases.

## Alternatives Considered

**Modular monolith** (single Nest.js app, internal module boundaries enforced
by import rules, one Postgres database):
Rejected. While this would be the pragmatic choice for an app this size, it
doesn't exercise cross-service auth (a service trusting another service's
JWT), eventual consistency, saga/compensation logic, an outbox pattern, or
independent deployability — all explicitly the skills this project exists to
demonstrate. A monolith with "modules" can fake some of this with internal
event emitters, but the failure modes (partial commits, network timeouts,
message redelivery) that make distributed systems hard simply don't exist if
everything shares one process and one transaction.

**Monolith first, extract services later** (start as a monolith, split into
services once a real need appears):
Rejected for this project specifically. "Real need" never appears for a
portfolio app with no real load — the extraction would have to be artificially
forced anyway, at which point doing it from day one is more honest about what
is being demonstrated, and avoids a mid-project rewrite that would eat time
better spent on the actual distributed-systems patterns (sagas, ledgers,
concurrency).

## Consequences

**Positive:**

- Forces real practice with service-to-service authentication, RabbitMQ,
  sagas, the outbox pattern, and per-service schema ownership — the core
  skills this project is meant to showcase.
- Each service can be reasoned about, tested, and deployed independently
  (separate Railway deployments, separate CI jobs).
- Database-per-service makes the "no shared database" discipline
  non-negotiable from the start, rather than something to retrofit.

**Negative:**

- Significant operational overhead for the actual feature set: 4+ Postgres
  databases, a message broker, and a Redis instance for what is functionally
  a small personal-banking app.
- Cross-service consistency is hard: the saga/outbox machinery in
  Transactions exists purely to handle failure modes that wouldn't exist in a
  single database transaction.
- Local development requires docker-compose running 6+ containers; debugging
  a single user flow (e.g. a transfer) means tracing logs across two or three
  services.
- More boilerplate per service (each needs its own Prisma setup, auth guard,
  health check, Dockerfile, CI job).

**At higher scale we would consider:**

- This is the direction scale would push _toward_, not away from — if
  MiniBank had real traffic, the per-service databases and event-driven
  boundaries already in place would let individual services (most likely
  Accounts/Transactions) scale independently without further architectural
  change.
- The one thing that might get revisited at scale is the Gateway → Services
  synchronous REST calls for commands — under heavy load these might move to
  async request/response over RabbitMQ with the Gateway streaming results, to
  avoid cascading latency under load spikes.
