# MiniBank — Project Brief

## What this is

A production-grade banking microservices platform demonstrating distributed
systems patterns, financial-grade correctness, and modern backend architecture.
Built as a portfolio project to demonstrate strong-junior to mid-level
backend engineering capability.

## What this is NOT

- A real bank (no KYC, no regulatory compliance, no real money)
- A feature-complete product (no cards, loans, statements, investments)
- A mobile app (web only)
- A multi-region system (single region, single deployment per service)

If a feature does not demonstrate a specific technical skill, it does not
go in.

## Core capabilities

1. User registration and authentication (JWT with refresh rotation)
2. Multi-currency account creation per user (USD, EUR, GBP)
3. Deposits and withdrawals (admin/seeding flows)
4. Money transfers between accounts (the headline feature)
5. Transaction history with filtering and pagination
6. Email notifications on significant events
7. Admin dashboard (Next.js frontend)

## Architecture overview

Four backend services + one API gateway + one frontend:

- **Gateway** (Nest) — single public entry point, auth verification,
  rate limiting, request routing
- **Auth Service** (Nest) — owns users, credentials, tokens
- **Accounts Service** (Nest) — owns accounts and the append-only ledger
- **Transactions Service** (Nest) — orchestrates transfers via saga pattern
- **Notifications Service** (Nest) — consumes events, sends emails
- **Web** (Next.js) — admin dashboard

Inter-service communication:

- Gateway → Services: REST
- Services → Services (commands): REST
- Services → Services (events): RabbitMQ
- Cross-cutting state: Redis (sessions, idempotency keys, rate limits)

Each service has its own PostgreSQL database. Each service has its own
Prisma schema and migrations. No shared databases.

## The three hard problems being solved

### 1. Idempotent transfers

Clients send `Idempotency-Key` header on transfer requests. Transactions
service stores key → response in Redis with 24h TTL. Duplicate requests
return cached response; conflicting requests with same key return 409.

### 2. Distributed transaction (saga)

Transfers span Accounts service (debit + credit). Orchestrated saga
in Transactions service with outbox pattern guarantees:

- Either both ledger entries are written (committed)
- Or compensating reversal entry is written (rolled forward)
  Saga states: INITIATED → DEBIT_PENDING → DEBIT_COMPLETE →
  CREDIT_PENDING → COMPLETED (or COMPENSATING → COMPENSATED on failure)

### 3. Append-only ledger

Balances are never stored as mutable fields. Balance = SUM of ledger
entries for an account. Concurrent debits handled via SELECT FOR UPDATE
on account_locks table inside Prisma interactive transaction. Reversals
are new entries with opposite sign — we never delete or update entries.

## Tech stack

- Node (latest) LTS, TypeScript strict mode
- Nest.js 10 (all backend services)
- Next.js 15 (App Router) + Tailwind + shadcn/ui + TanStack Query
- PostgreSQL 16 (one DB per service)
- Prisma ORM (separate schema per service)
- Redis 7 (cache, idempotency, rate limits)
- RabbitMQ (async events)
- JWT RS256 + argon2 password hashing
- class-validator + zod for validation
- Jest + Supertest + Testcontainers for testing
- Winston for structured logging with correlation IDs
- Docker + docker-compose for local dev
- Turborepo + pnpm workspaces for monorepo
- GitHub Actions for CI
- Railway for deployment
- Kubernetes manifests included (not deployed) for production topology demo

## Quality standards (every service meets these)

- ESLint + Prettier + Husky pre-commit hooks
- TypeScript strict mode, no `any` better is `unknown`
- Unit tests on services, integration tests on critical paths,
  e2e tests on happy paths
- 70%+ test coverage on business logic
- OpenAPI documentation via Swagger
- Health check endpoint with dependency checks
- Structured logging with request correlation IDs
- Graceful shutdown handling
- Multi-stage Dockerfile, non-root user, small final image
- Helmet, CORS, rate limiting, input validation on all endpoints
- Migrations committed and run via `prisma migrate deploy` in CI

## Documentation deliverables

- Top-level README (the marketing piece)
- Per-service README (the technical detail)
- `docs/architecture.md` — system design deep dive
- `docs/adr/` — Architecture Decision Records (one per major decision)
- OpenAPI spec hosted live
- Loom demo video (3 minutes)
- Blog post on dev.to about the saga implementation

## Out of scope

- Card management
- Loans, investments, savings goals
- Mobile app
- Multi-region deployment
- Real KYC or identity verification
- Real money or real payment processor integration
- PDF statements
- Multi-language UI
- Dark mode (Tailwind/shadcn defaults are fine, do not customize)
- Custom design system (use shadcn out of the box)
