# ADR-003: Pessimistic row locking for deposit/withdrawal concurrency

**Status:** Accepted
**Date:** 2026-06-12

## Context

Because balances are derived (`SUM(amount)` over `ledger_entries`, per
[ADR-002](002-append-only-ledger.md)), a deposit or withdrawal is really
"read the current balance, check it, then write a new ledger entry" — three
steps that are not atomic on their own.

Without protection, two concurrent withdrawals against the same account can
both read the same balance, both see "sufficient funds", and both commit:

```
Account balance: $100
Request A: read balance ($100) → $60 ≤ $100, OK → write -$60 entry
Request B: read balance ($100) → $60 ≤ $100, OK → write -$60 entry
Result: balance = -$20
```

`PROJECT_BRIEF.md` and `SPRINT_PLAN.md` both call for solving this with
`SELECT ... FOR UPDATE` inside a Prisma interactive transaction, originally
sketched against a dedicated `account_locks` table (one row per account,
created alongside the account, whose sole purpose is to be the target of the
`FOR UPDATE`).

## Decision

Lock the **`accounts` row itself** — there is no `account_locks` /
`AccountLock` table in the schema.

`AccountsRepository.withAccountLock(accountId, fn)` wraps `fn` in a Prisma
interactive transaction whose first statement is:

```sql
SELECT id FROM accounts WHERE id = $1 FOR UPDATE
```

This takes a row-level write lock on that account's row for the lifetime of
the transaction. A second concurrent call to `withAccountLock` for the same
`accountId` blocks on this `SELECT` until the first transaction commits or
rolls back, then proceeds with a fresh read of the ledger — so it sees the
balance _after_ the first withdrawal, not the stale one.

`AccountsService.deposit`/`withdraw` both run their entire
read-balance → validate → write-entry sequence inside `withAccountLock`, so
the lock covers exactly the critical section and nothing else.

## Alternatives Considered

**Dedicated `account_locks` table, `SELECT ... FOR UPDATE` on that table**
(the approach sketched in `PROJECT_BRIEF.md`): Rejected. Postgres can take a
row lock on _any_ row, including the `accounts` row that the operation is
already about — a separate lock table adds a second row that must be created
in the same transaction as the account (and never go missing, or `FOR UPDATE`
silently locks nothing), with no extra correctness or performance benefit over
locking the account row directly. It's an extra table, an extra insert per
account, and an extra join, for a lock that Postgres already gives us on data
we're touching anyway.

**Optimistic concurrency** (a `version`/`updated_at` column on `Account`,
write fails if the version changed since read, client retries): Rejected for
this domain. Under contention, a withdrawal that is actually valid (sufficient
funds) could still fail with "conflict, please retry" purely because another
request touched the account first — for money movements I want a single
request to resolve to a deterministic outcome (succeeds, or fails with
`INSUFFICIENT_FUNDS`), not a transient failure the caller has to interpret and
retry. Optimistic locking also doesn't compose well with the saga pattern
planned for Week 3, where a transaction service needs a definite yes/no from
each leg.

**Application-level distributed lock** (e.g. a Redis lock keyed by
`accountId`): Rejected. This would introduce a second system that has to be
correct and available for money operations to proceed, and that can desync
from Postgres (lock acquired but the DB transaction fails, or vice versa).
Postgres's own transactional row locks are already durable, already
participate in the same commit/rollback as the ledger write, and require no
extra infrastructure.

## Consequences

**Positive:**

- Correctness is enforced by Postgres itself, in the same transaction as the
  data it protects — no separate lock state that can drift out of sync with
  the ledger.
- One fewer table/model than the originally planned `account_locks`, and one
  fewer thing to keep in sync when accounts are created.
- Directly verified by `accounts.repository.spec.ts`: two concurrent $60
  withdrawals against a $100 balance via `Promise.all` resolve to exactly one
  success, and the final balance is `$40`, never `-$20`.

**Negative:**

- The lock is held for the full duration of `withAccountLock`'s callback, so
  all deposit/withdrawal operations on the _same account_ are fully
  serialized — a second request waits for the first to commit even if they
  don't logically conflict (e.g. two deposits, which can't actually
  over-draw). The callback must stay small (read balance, validate, write one
  entry) to keep this window short.
- This only serializes operations on a single account. A transfer between two
  accounts (Week 3) will need to acquire both accounts' locks in a consistent
  order to avoid deadlocks — not yet designed, called out here as a follow-up
  for the Transactions ADR.

**At higher scale we would consider:**

- Per-account serialization via an in-memory queue/actor (one worker per
  `accountId`) so a blocked request doesn't hold a database connection for the
  duration of the wait — useful if a single account becomes a hotspot (e.g. a
  popular merchant account).
- Revisiting optimistic concurrency with idempotency keys once the
  client-facing retry UX has been designed, for read-heavy/low-contention
  accounts where serialization overhead outweighs the rare conflict.
