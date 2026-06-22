# ADR-002: Append-only ledger for account balances

**Status:** Accepted
**Date:** 2026-06-12

## Context

The Accounts service needs to track how much money is in each account, and
that number has to be trustworthy: every deposit, withdrawal, and (in Week 3)
transfer leg must be individually auditable, and it must always be possible to
prove _why_ an account holds the balance it holds.

`PROJECT_BRIEF.md` states this directly: "Balances are never stored as
mutable fields. Balance = SUM of ledger entries for an account... Reversals
are new entries with opposite sign — we never delete or update entries."

The question this ADR answers is how the `Account`/`LedgerEntry` schema and
the repository methods that read/write balances should be designed to satisfy
that constraint.

## Decision

- `LedgerEntry` (`@@map("ledger_entries")`) is **append-only**: the
  application never issues an `UPDATE` or `DELETE` against this table.
  Every deposit, withdrawal, transfer leg, or reversal is a brand-new row.
- Each entry stores a signed `amount` (`Decimal(19, 4)`) — positive for money
  coming in (`DEPOSIT`, `TRANSFER_CREDIT`), negative for money going out
  (`WITHDRAWAL`, `TRANSFER_DEBIT`). `REVERSAL` entries simply negate the
  amount of the entry they reverse.
- `Account` has **no `balance` column at all**. A balance is always derived:
  `AccountsRepository.computeBalance` runs
  `SUM(amount) WHERE account_id = ...` (via `prisma.ledgerEntry.aggregate`),
  defaulting to `0` when there are no entries yet.
- `relatedTransactionId` is an optional nullable field on `LedgerEntry`,
  unused by Accounts itself this week, but reserved so the Transactions
  service (Week 3) can tie a `TRANSFER_DEBIT`/`TRANSFER_CREDIT` pair — and any
  later `REVERSAL` — back to the saga that produced them.
- `Decimal(19, 4)` gives 4 decimal places of precision (vs. the 2 shown to
  users for USD/EUR/GBP), leaving headroom for future FX-rate or interest
  calculations that need sub-cent precision before rounding for display.

## Alternatives Considered

**Mutable `balance` column on `Account`, updated in place on each
operation** (optionally with a `version` column for optimistic locking):
Rejected. The stored number would be the _only_ record of the account's
state — if it's ever wrong (a bug, a bad migration, a manual `UPDATE` during
an incident), there is nothing to recompute it from or reconcile it against.
An audit trail would have to be bolted on separately, and now there are two
representations of "how much money is in this account" that can drift apart.

**Mutable `balance` column as the source of truth, plus a separate immutable
log table purely for audit**: Rejected for the same reason as above, just one
level removed — the log table looks like a ledger, but it isn't authoritative,
so a bug that updates `balance` without writing to the log (or vice versa)
produces exactly the "balance doesn't match its own history" inconsistency
that a real ledger is supposed to make structurally impossible. If the ledger
is going to exist anyway, it should be the only source of truth.

## Consequences

**Positive:**

- Full audit trail by construction — for any account, "how did the balance
  get to X" is always answerable by reading `ledger_entries`, because that
  table _is_ the history, not a side effect of it.
- Balance correctness reduces to "is the SUM correct", which is trivial to
  reason about and test (see `accounts.repository.spec.ts`'s balance tests).
- Corrections, reversals, and (later) saga compensations need no special-cased
  "undo" logic — they're just new rows with an opposite sign and a
  `REVERSAL`/`TRANSFER_*` type.
- Multi-currency and future transaction types (`TRANSFER_DEBIT`,
  `TRANSFER_CREDIT`, `REVERSAL`) are already represented in the
  `LedgerEntryType` enum, so Week 3 doesn't need a schema migration just to
  start writing transfer legs.

**Negative:**

- Every balance read is an aggregate query over `ledger_entries`, not a single
  row lookup — cost grows with the number of entries for an account.
- There is no "balance" field to put in a simple `SELECT *` — every caller
  that needs a balance must go through `computeBalance`/`getBalance`, which is
  an easy thing to forget if a new read path is added later.

**At higher scale we would consider:**

- A periodic balance **snapshot** (e.g. a `balance_as_of` row per account,
  recomputed nightly or on a schedule) that later balance reads start from and
  sum only the entries _after_ the snapshot, instead of the full history. This
  is the standard "checkpoint + replay" pattern from double-entry bookkeeping
  systems, and it preserves the append-only guarantee — the snapshot is a
  cache of a SUM, not a new source of truth.
