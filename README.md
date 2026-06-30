# MiniBank

A production-grade banking platform built with microservices, demonstrating distributed systems patterns at the level expected of a mid-level backend engineer.

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-FF6600?logo=rabbitmq&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-monitored-E6522C?logo=prometheus&logoColor=white)

## What it does

- Register and authenticate users (JWT RS256, refresh token rotation)
- Create multi-currency accounts (USD, EUR, GBP)
- Deposit and withdraw funds with concurrency safety
- Transfer money between accounts via a distributed saga
- Receive email notifications on transfer events
- Observe everything via Prometheus + Grafana

## Architecture

```
                        ┌─────────────────────────────────────────────────┐
                        │                  Next.js (Web)                  │
                        └───────────────────────┬─────────────────────────┘
                                                │ HTTP
                        ┌───────────────────────▼─────────────────────────┐
                        │              API Gateway :3000                  │
                        │      auth verification · rate limiting          │
                        └──────┬──────────────┬───────────────┬───────────┘
                               │              │               │
               ┌───────────────▼──┐  ┌────────▼───────┐  ┌───▼─────────────┐
               │  Auth :3001      │  │ Accounts :3002  │  │ Transfers :3003  │
               │  users · tokens  │  │ ledger · locks  │  │ saga · outbox    │
               └──────────────────┘  └────────┬────────┘  └───┬─────────────┘
                       │ Postgres              │ Postgres      │ Postgres
                    auth_db               accounts_db      transfers_db
                                                               │
                                                               │ RabbitMQ
                                               ┌──────────────▼──────────────┐
                                               │   Notifications :3004        │
                                               │   email via MailHog/SES     │
                                               └─────────────────────────────┘

Observability: Prometheus :9090 · Grafana :3010
```

## Key patterns

| Pattern                         | Where                 | Why                                                                      |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| Saga orchestration              | Transfers service     | Keep accounts consistent across two DBs without distributed transactions |
| Outbox                          | Transfers → RabbitMQ  | Guarantee event delivery even if the broker is down at commit time       |
| Append-only ledger              | Accounts service      | Immutable audit trail; balance is always `SUM(entries)`                  |
| Refresh token rotation          | Auth service          | Detect stolen tokens; invalidate entire chain on reuse                   |
| `SELECT FOR UPDATE` row locking | Accounts service      | Prevent double-spend under concurrent withdrawals                        |
| Dead-letter queue               | Notifications service | Permanent failures don't block the queue; retried up to 5×               |

## Services

| Service       | Port | Stack                                 |
| ------------- | ---- | ------------------------------------- |
| Gateway       | 3000 | NestJS, Fastify                       |
| Auth          | 3001 | NestJS, Fastify, Prisma, Argon2, JWT  |
| Accounts      | 3002 | NestJS, Fastify, Prisma, Decimal.js   |
| Transfers     | 3003 | NestJS, Fastify, Prisma, RabbitMQ     |
| Notifications | 3004 | NestJS, Fastify, RabbitMQ, Nodemailer |
| Web           | 3005 | Next.js 15, TanStack Query, shadcn/ui |

## Running locally

**Prerequisites:** Node 20+, pnpm 9+, Docker

```bash
# 1. Clone and install
git clone https://github.com/Seyran23/mini-bank.git
cd mini-bank
pnpm install

# 2. Copy and fill environment variables
cp .env.example .env
# Fill in AUTH_JWT_*_KEY_BASE64 and AUTH_INTERNAL_API_KEY — see .env.example

# 3. Start infrastructure
docker compose up -d

# 4. Run migrations
pnpm --filter @minibank/auth exec prisma migrate deploy
pnpm --filter @minibank/accounts exec prisma migrate deploy
pnpm --filter @minibank/transfers exec prisma migrate deploy

# 5. Start all services (separate terminals)
pnpm --filter @minibank/gateway dev
pnpm --filter @minibank/auth dev
pnpm --filter @minibank/accounts dev
pnpm --filter @minibank/transfers dev
pnpm --filter @minibank/notifications dev
pnpm --filter @minibank/web dev
```

| URL                        | What                                      |
| -------------------------- | ----------------------------------------- |
| http://localhost:3005      | Web dashboard                             |
| http://localhost:3000/docs | Swagger (all services)                    |
| http://localhost:9090      | Prometheus                                |
| http://localhost:3010      | Grafana (admin / admin)                   |
| http://localhost:15672     | RabbitMQ management (minibank / minibank) |
| http://localhost:8025      | MailHog (captured emails)                 |

## Running tests

```bash
pnpm test          # unit tests across all packages
pnpm test:e2e      # e2e tests (requires Docker for Testcontainers)
```

## Project structure

```
mini-bank/
├── apps/
│   ├── gateway/        # API gateway
│   ├── auth/           # Auth service
│   ├── accounts/       # Accounts & ledger service
│   ├── transfers/      # Transfers & saga service
│   ├── notifications/  # Event consumer & email service
│   └── web/            # Next.js frontend
├── packages/
│   ├── types/          # Shared event and domain types
│   ├── errors/         # Shared HTTP error classes
│   ├── logger/         # Pino logger factory
│   └── config/         # Typed env config per service
├── monitoring/
│   ├── prometheus.yml  # Scrape config + alert rules
│   ├── alerts.yml      # Alerting rules (7 rules, 4 groups)
│   └── grafana/        # Pre-provisioned dashboard
└── docs/
    ├── adr/            # Architecture decision records (ADR-001–007)
    └── architecture.md # Detailed diagrams and design notes
```

## ADRs

Architecture decisions are documented in [`docs/adr/`](docs/adr/):

- [ADR-001](docs/adr/001-microservices-over-modular-monolith.md) — Microservices over modular monolith
- [ADR-002](docs/adr/002-append-only-ledger.md) — Append-only ledger design
- [ADR-003](docs/adr/003-concurrency-row-locking.md) — Row locking for concurrency
- [ADR-004](docs/adr/004-saga-orchestration-vs-choreography.md) — Saga orchestration vs choreography
- [ADR-005](docs/adr/005-outbox-pattern.md) — Outbox pattern for event delivery
- [ADR-006](docs/adr/006-gateway-responsibilities.md) — Gateway responsibilities
- [ADR-007](docs/adr/007-monorepo-independent-deployment.md) — Monorepo with independent deployments
