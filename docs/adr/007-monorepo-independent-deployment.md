# ADR-007: Monorepo with Independent Deployments

**Status:** Accepted
**Date:** 2026-06-30

## Context

MiniBank has 5 NestJS backend services, 1 Next.js frontend, and 4 shared
packages (`types`, `errors`, `logger`, `config`). We needed to decide how to
organise these across git repositories.

The critical constraint is the shared packages — particularly `@minibank/types`,
which defines the event contracts (e.g. `TransferCompletedEvent`) that the
Transfers and Notifications services must agree on. Any mismatch between producer
and consumer causes silent runtime failures or crashes.

At the same time, each service must remain independently deployable: its own
database, its own migration history, its own environment config, its own
process. A deploy of the Notifications service must not require redeploying Auth.

## Decision

Use a **single pnpm workspace monorepo managed by Turborepo**, where:

- All services and shared packages live under one git repo
- Services share packages via workspace protocol (`@minibank/types: workspace:*`),
  never via npm publishing
- Each service is independently deployable: its own Dockerfile, its own
  environment variables, its own Prisma schema and migrations, its own port
- Turborepo's task graph handles build ordering (`types` and `errors` build
  before the services that depend on them)

## Alternatives Considered

**Polyrepo — one git repo per service**

Each service lives in its own repo. Shared packages are published to npm (or a
private registry) and versioned independently.

Rejected because: the shared `@minibank/types` package would require a
publish-bump-update cycle on every event schema change. In a polyrepo, if
`TransferCompletedEvent` gains a new required field, the Transfers service
compiles fine on its own — the Notifications service only breaks when you try
to deploy it, not when you write the change. The monorepo makes this a single
`tsc` run that fails at the source.

**Modular NestJS monolith**

All services as NestJS modules in one application, sharing one database.

Rejected because: modules in a monolith cannot be deployed or scaled
independently, share a single database connection pool and schema, and make
it impossible to demonstrate distributed systems patterns (saga, outbox,
event-driven communication) that are the point of this project.
(See also ADR-001.)

## Consequences

**Positive:**

- Shared type definitions are enforced at compile time across all services.
  Renaming an event field or adding a required property breaks every consumer
  immediately in CI, not at runtime in production.
- Cross-cutting changes (e.g. adding a field to the logger, updating an error
  class) are a single commit and a single PR.
- Consistent tooling: one ESLint config, one `tsconfig.base.json`, one
  Prettier setup, one `turbo.json` task graph for the whole project.
- Turborepo caches build artifacts. Only services whose source or dependencies
  changed are rebuilt or re-tested on each CI run.

**Negative:**

- A breaking change to a shared package (e.g. a non-backwards-compatible change
  to `@minibank/errors`) forces all services to be updated in the same commit.
  In a polyrepo each service could adopt it on its own schedule. Mitigated
  by TypeScript strict mode making breakage visible immediately.
- The monorepo is a single clone. Developers working on only one service still
  pull the full codebase. At current scale (~6 services) this is a non-issue.
- CI must understand the task graph to avoid running every service's tests on
  every change. Turborepo's `dependsOn` and remote caching handles this, but
  requires initial setup.

**At higher scale we would consider:**

- **Nx** or **Bazel** for more granular remote caching and affected-package
  detection across hundreds of packages.
- Publishing internal shared packages to a private npm registry so that services
  can independently pin to a version and upgrade on their own schedule, trading
  compile-time safety for deployment flexibility.
- Splitting into a small number of polyrepos grouped by domain (e.g. one repo
  for all financial services, one for infra/platform) when team boundaries
  make a single repo too noisy.
