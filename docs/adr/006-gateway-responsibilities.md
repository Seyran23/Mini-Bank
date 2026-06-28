# ADR-006: API Gateway responsibilities

**Status:** Accepted
**Date:** 2026-06-26

## Context

Through Week 3, every client talked directly to whichever service owned the
data it wanted: Auth on `:3001`, Accounts on `:3002`, Transfers on `:3003`.
`docs/SPRINT_PLAN.md` Week 4 calls for a single public entry point —
"API Gateway: routing, auth verification, rate limiting. Helmet, CORS
hardening. Swagger published on gateway, aggregating service specs" — so a
frontend (or any external caller) only needs to know one URL, and
perimeter concerns (security headers, throttling, CORS) live in one place
instead of being duplicated across services that should stay focused on
their own domain logic.

Each downstream service already has its own internal-only endpoints
(`GET /auth/internal/users/:id`, `POST /accounts/:id/internal/transfer-*`)
guarded by `InternalAuthGuard` and a shared API key — these exist purely
for service-to-service calls within the Docker network (Transfers calling
Accounts, Notifications calling Auth) and must never become reachable from
outside it. Introducing a public-facing Gateway raises the obvious
question of how that boundary stays enforced once there's a new front door.

## Decision

Five decisions, made together as the Gateway's design:

**1. Hand-rolled forwarding, not a reverse-proxy plugin.** Each public route
gets its own Nest controller method that calls a plain `fetch()`-based
service class (`AuthService`, `AccountsService`, `TransfersService` —
mirroring `apps/transfers/src/accounts-client/accounts-client.service.ts`'s
existing style), rather than registering a generic plugin like
`@fastify/http-proxy` that forwards arbitrary paths. This keeps every
forwarded route on the same Nest guard/interceptor/filter pipeline every
other service in this codebase already uses, and costs zero new
dependencies.

**2. Route allowlisting by construction, not a denylist.** The Gateway
only ever implements the public routes (`/auth/register`, `/accounts`,
`/transfers/:id`, etc.) — internal routes are simply never written as
controller methods. A request to `/auth/internal/users/:id` or
`/accounts/:id/internal/transfer-debit` 404s the same way any nonexistent
URL would, because Fastify's router has no entry for it. There is no
runtime check, header strip, or path filter doing this — the safety
property comes from the routes' absence, which can't be misconfigured the
way a denylist regex could be.

**3. The Gateway verifies JWTs itself, in addition to each downstream
service still verifying independently.** `JwtAuthGuard` runs on
`AccountsController`/`TransfersController` exactly as it already does on
the real Accounts/Transfers services (same RS256 public-key check). This
rejects unauthenticated traffic at the edge before it costs a network hop,
and lets the Gateway's own logs carry `userId` — at the cost of verifying
the same token twice per request. Downstream verification is left in
place rather than removed, continuing this codebase's existing
defense-in-depth posture (no service trusts an upstream caller's say-so
about who a user is).

**4. Helmet via `@fastify/helmet`; rate limiting via `@nestjs/throttler`**
— both new dependencies, added specifically because the Gateway is the
first place in this codebase that needs perimeter security headers and
request throttling; no other service is a public entry point. Helmet is
registered as a raw Fastify plugin (`app.register(fastifyHelmet)`) since
it only sets response headers — no DI, no guards, nothing to gain from a
Nest wrapper, and this is the approach Nest's own docs recommend. Rate
limiting uses `@nestjs/throttler`'s `ThrottlerModule`/`ThrottlerGuard`
instead of the Fastify-ecosystem equivalent (`@fastify/rate-limit`) so
that exceeding the limit throws a normal Nest `HttpException`
(`ThrottlerException`) that flows through the existing
`HttpExceptionFilter` unmodified — every other exception in this codebase
is already a Nest `HttpException` or an `AppException`, and a raw
Fastify-thrown error would have been the only exception to that rule.
`@fastify/helmet` had to be pinned to its Fastify-v4-compatible major
(`^11`), matching `@fastify/static@^7.0.4`'s existing pin elsewhere in
this codebase — `@nestjs/platform-fastify@10.4.22` bundles its own
private `fastify@4.28.1` internally regardless of what `fastify` version
any service's own `package.json` declares, so any _raw Fastify plugin_ in
this codebase must target v4, not whatever the app's direct dependency
says. `@nestjs/throttler` has no such constraint since it's a pure Nest
package with no Fastify-version coupling at all.

**5. Swagger is hand-documented on the Gateway**, using the same
`DocumentBuilder` + `SwaggerModule.setup('docs', ...)` pattern every
service already uses, with `@ApiOperation`/`@ApiOkResponse`/`@ApiProperty`
decorators on the forwarding controllers and their DTOs — rather than
fetching and merging each downstream service's `/docs-json` at startup.

## Alternatives Considered

**`@fastify/http-proxy` for routing**: Rejected. It registers directly on
the raw Fastify instance, bypassing Nest's request pipeline entirely —
`JwtAuthGuard`, `CorrelationIdInterceptor`, and `HttpExceptionFilter` would
all need separate Fastify-hook reimplementations, a second pipeline running
alongside the one every other route already uses. It would also forward
_any_ path by default, making the internal-route safety property a denylist
someone has to remember to maintain, not a structural absence.

**Denylist-based path filtering**: Rejected for the reason above — a
denylist has to be correct forever; an allowlist (routes that simply don't
exist) can't accidentally regress when someone adds a new internal endpoint
to Accounts or Auth later and forgets to update the Gateway's filter.

**Trust-and-forward (no JWT verification at the Gateway)**: Considered and
rejected. It would save one redundant RS256 verification per request, but
every unauthenticated request would still cost a full network round-trip to
a downstream service before being rejected there, and the Gateway's own
logs would have no `userId` to correlate with.

**`@fastify/rate-limit` for throttling**: Tried first, then reverted.
Functionally it worked (correctly tracked request counts and set
`x-ratelimit-*` headers), but it throws a plain Fastify-level error rather
than a Nest `HttpException`, so it bypassed `HttpExceptionFilter`'s normal
handling entirely and surfaced as a `500` instead of `429` until the filter
was given a special case just for it. `@nestjs/throttler` avoids the
special case altogether by throwing something the filter already knows how
to handle — the correct lesson being that ADR-006's own point 1 (stay
inside Nest's pipeline) applies to _every_ cross-cutting concern added to
the Gateway, not just routing.

**Fetching and merging each service's `/docs-json` into one spec**:
Rejected for now. It would keep documentation perfectly in sync with each
downstream DTO automatically, but requires a real OpenAPI-merging step
(namespacing `paths`/`components.schemas` to avoid collisions) and a
startup-time dependency on all three services being reachable — a kind of
dynamic cross-service composition this codebase doesn't do anywhere else.
Hand-documented routes can drift if a downstream DTO changes without the
Gateway being updated, accepted as the simpler tradeoff for now.

## Consequences

**Positive:**

- Internal endpoints are unreachable through the Gateway by construction —
  verified directly: `GET /auth/internal/users/:id` and
  `POST /accounts/:id/internal/transfer-debit` both return `404` when sent
  to the Gateway.
- Every forwarded route still goes through the exact same guard/interceptor/
  filter pipeline as every other service, so correlation-id propagation and
  structured logging work identically at the edge.
- No generic proxy library to learn or debug — the forwarding logic is
  ordinary, readable Nest code, consistent with this codebase's preference
  for visible mechanics over wrapper libraries (e.g. raw `amqplib` over
  `@nestjs/microservices`).

**Negative:**

- Every protected route does two RS256 verifications per request (Gateway,
  then the downstream service) — redundant CPU work, accepted for the
  edge-rejection and logging benefits.
- Adding a new endpoint to Accounts or Transfers means manually adding the
  matching forwarding method to the Gateway too — nothing detects a
  downstream route the Gateway hasn't caught up to yet.
- Swagger docs on the Gateway can silently drift from the real downstream
  DTOs if one changes without the other being updated.

**At higher scale we would consider:**

- A real API gateway product (Kong, Envoy, AWS API Gateway) once routing
  rules, rate-limit tiers, or auth schemes get complex enough that
  hand-rolled forwarding methods stop being the simplest option.
- Revisiting `/docs-json` aggregation if the manual DTO duplication between
  the Gateway and downstream services becomes a recurring source of bugs.
- A shared-secret or mTLS check between the Gateway and downstream services,
  so a downstream service could distinguish "request came through the
  Gateway" from "request hit me directly" — not needed today since every
  service still verifies the user's JWT independently regardless of origin.
