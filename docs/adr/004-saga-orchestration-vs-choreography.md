# ADR-004: Saga orchestration for cross-account transfers

**Status:** Accepted
**Date:** 2026-06-24

## Context

A transfer moves money between two accounts that live in the **same**
Accounts database, but the operation that orchestrates a transfer — debit
one account, then credit the other — lives in a separate service
(`apps/transfers`) with its own database. There is no single database
transaction that can span both steps: Accounts commits the debit in its own
transaction, and the credit is a second, independent call.

`PROJECT_BRIEF.md` specifies the saga states a transfer moves through
(`INITIATED → DEBIT_PENDING → DEBIT_COMPLETE → CREDIT_PENDING → COMPLETED`,
or `→ COMPENSATING → COMPENSATED`/`FAILED` on failure) and calls for the
orchestration to live in the Transactions service. `docs/SPRINT_PLAN.md`
lists this exact decision (orchestration vs. choreography) as something this
ADR needs to settle.

[ADR-003](003-concurrency-row-locking.md) flagged this exact gap as a
follow-up: "a transfer between two accounts will need to acquire both
accounts' locks in a consistent order to avoid deadlocks — not yet
designed." This ADR's decision resolves that concern by avoidance rather
than by ordering — see Consequences below.

## Decision

**Orchestration**, not choreography. `apps/transfers` owns a `Transfer` row
with a `sagaState` column and is the _only_ caller of the three internal
endpoints Accounts exposes for this purpose
(`transfer-debit`/`transfer-credit`/`reversal`). Accounts never calls back
into Transfers, and never knows it's part of a saga at all — from its
perspective, these are just three more ledger-writing endpoints, guarded by
a shared internal API key instead of a user's JWT.

`TransferSagaRunner` (`@Interval(SAGA_POLL_INTERVAL_MS)`) polls for
non-terminal transfers and advances each one **sequentially**, one HTTP call
at a time:

1. `INITIATED` → claim → `DEBIT_PENDING` → call `transferDebit` → `DEBIT_COMPLETE`
2. `DEBIT_COMPLETE` → claim → `CREDIT_PENDING` → call `transferCredit` → `COMPLETED` (success) or `COMPENSATING` (failure)
3. `COMPENSATING` → call `reversal` → `COMPENSATED` (retried indefinitely on failure)

The claim steps (`INITIATED → DEBIT_PENDING`, `DEBIT_COMPLETE → CREDIT_PENDING`)
are a compare-and-swap (`TransfersRepository.claimTransfer`, via
`UPDATE ... WHERE id = ? AND sagaState = ?`) — only one caller can win a
given claim, which is what would make it safe to run more than one instance
of this poller later, even though only one instance runs today.

Each individual Accounts call (`transferDebit`/`transferCredit`/`reversal`)
takes Postgres's row lock on exactly **one** account at a time
(`AccountsRepository.withAccountLock`, per ADR-003) and releases it before
returning. The orchestrator never holds two account locks simultaneously —
debit's lock is released before credit's lock is even requested.

## Alternatives Considered

**Choreography** (Accounts publishes a "debited" event; some listener reacts
by telling Accounts to credit the other side; etc.): Rejected. There would
be no single place that answers "what state is this transfer in right now"
— that answer would be implicit in which events have and haven't fired
across however many services are listening. Adding a third step (or a third
participant, e.g. a fraud check) means teaching another service saga
semantics, instead of just adding a case to one `switch` statement in one
place. Debugging a stuck transfer would mean correlating logs across
multiple services instead of reading one `Transfer` row.

**Two-phase commit / distributed transaction across both databases**:
Rejected. Postgres has no built-in cross-database 2PC, and bolting one on
would mean an external transaction coordinator — a new piece of
infrastructure — plus holding locks on both accounts for the duration of a
network round-trip between services, for a domain where eventual consistency
with compensation (per `PROJECT_BRIEF.md`'s explicit design) is already an
accepted answer.

**Acquiring both accounts' locks up front, in a consistent order** (the
approach ADR-003 originally anticipated): Rejected once orchestration was
chosen, because it's unnecessary — the saga never needs both locks at the
same time. Debit completes and releases its lock entirely before credit is
even attempted; there is no scenario where this design holds two account
locks concurrently, so there's no deadlock-ordering problem to solve.

## Consequences

**Positive:**

- `GET /transfers/:id` is always a direct, truthful answer to "what's
  happening with this transfer" — no event correlation required.
- ADR-003's flagged deadlock-ordering concern doesn't need a follow-up
  design at all — sequential, single-lock-at-a-time calls make it
  structurally impossible to deadlock on two accounts' locks.
- Every step Accounts performs is independently idempotent (dedup on
  `(accountId, relatedTransactionId, type)`), so the orchestrator is free to
  crash, restart, or retry any step without risking a double-debit or
  double-credit — verified by `accounts.repository.spec.ts` and exercised by
  `transfer-saga-runner.spec.ts`'s retry tests.
- The `claimTransfer` compare-and-swap means horizontal scaling of the saga
  runner (multiple instances) is already safe by construction, even though
  it isn't exercised today.

**Negative:**

- `apps/transfers` is a single coordinator — if it's down, in-flight
  transfers simply stop progressing until it comes back, though no transfer
  is lost or corrupted (its `sagaState` is durable, and the next tick resumes
  exactly where it left off).
- This is eventual consistency, not atomicity: between `DEBIT_COMPLETE` and
  `COMPLETED` there's a real window where money has left the source account
  but hasn't yet reached the destination, invisible to a user looking only
  at account balances. Accepted per `PROJECT_BRIEF.md`, but worth being
  explicit that a "transfer" here is not an instantaneous atomic swap.
- A transfer stuck in `COMPENSATING` (reversal keeps failing) retries
  forever by design — there is no alerting today if that goes on for an
  unexpectedly long time.

**At higher scale we would consider:**

- A max-retry-then-alert threshold on `COMPENSATING`, instead of unbounded
  retry — fine for a learning project, not fine if Accounts ever has a
  multi-hour outage in production.
- If the saga runner is ever scaled to multiple instances, pairing
  `claimTransfer`'s existing compare-and-swap with a `LIMIT`/batched claim in
  `findNonTerminalTransfers` so every instance isn't scanning the entire
  non-terminal set on every tick.
