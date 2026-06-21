# ADR-0001: Backend Platform Choice — NestJS + Prisma + Postgres (Path B), with managed realtime/PostGIS

- **Status:** **Accepted (2026-06-18)** — Path B confirmed by the user; team fluency confirmed as Nest/Prisma/Socket.IO/Jest (the linchpin held).
- **Date:** 2026-06-18
- **Decision drivers chosen by:** §10/§14 of the Engineering Plan (Phase-0 must de-risk the three hard problems first)
- **Recommended path:** **B (NestJS + Prisma + Postgres)** at **0.76 confidence**
- **How this was produced:** a 4-lens judge panel (velocity / correctness / realtime+geo / ops+authz) each scored the decision independently, then a synthesizer resolved the disagreements. Raw vote split was **2–2** (Velocity→B, Correctness→A, Realtime+Geo→A, Ops/Authz→B); the recommendation resolves the split rather than averaging it.

---

## Context

We are choosing the single source-of-truth backend for an Egypt-market, Arabic-first hypermarket e-commerce + delivery platform. One backend and one `packages/shared` serve two surfaces: a read-only-on-catalog Expo customer app (writes only orders) and a role-gated React/Vite dashboard (HQ Central Command + Branch Operations) that owns catalog, inventory, pricing, zones, staff/roles, and the all-orders firehose. The backend must be server-authoritative and transactional for stock decrement, price/promo, order placement, and payment status.

Three hard problems must be de-risked **first** in Phase-0 spikes:
1. **Race-safe per-branch reservation stock** (`available → reserved → fulfilled`, `CHECK qty_available >= 0`, 20-concurrent / stock=1 ⇒ exactly 1 success).
2. **Geo branch-routing** via PostGIS polygons (`ST_Contains`, priority + distance tie-break, reject outside zones).
3. **Realtime as an optimization over REST** (channel-per-branch, channel-per-order, throttled courier location, reconnect refetch via TanStack Query).

Plus: phone OTP, data-layer branch-scoped RBAC proven with negative tests, idempotent checkout, signed Paymob webhooks (COD first), image storage, shared Zod in a pnpm/Turborepo monorepo, and `audit_log` on every catalog/stock/price/visibility change.

### ⚠️ Greenfield caveat (added after the user confirmed this is a brand-new project)

The panel's synthesizer inspected **git HEAD** and found the repository's history still contains a working **NestJS 11 + Prisma 6** backend from a prior project (`bclinic`, a clinic/booking domain) with passing specs for nearly every hard component here:
- `server/src/bookings/bookings.service.ts` — re-check + write inside an interactive `prisma.$transaction` with a `ConflictException` race fallback (the exact shape of the oversell problem).
- `server/src/tickets/tickets.service.ts` — `Prisma.TransactionIsolationLevel.Serializable` cap-check.
- `server/src/bookings/bookings.gateway.ts` — a namespaced (`/bookings`) Socket.IO gateway with role-gated `clinic-${id}` rooms (**this is channel-per-branch**).
- `server/src/auth/guards/{roles,employee-clinic-access,only-own-profile}.guard.ts` — negative-authz guard `.spec.ts` tests.

**The user has stated this is a whole-new project**, and the working tree is empty (the old code is staged for deletion). So that asset will **not** be the literal starting codebase. This matters because part of Path B's velocity advantage rested on copy-adapting that code. The recommendation is therefore re-weighted below:
- What survives regardless of code reuse: the git history is strong evidence the **team's demonstrated fluency is Nest/Prisma/Socket.IO/Jest** (not Deno Edge Functions, PL/pgSQL, or RLS). Familiarity is a durable velocity factor independent of whether we copy a single file.
- What weakens if we discard the old code: the "~70% reuse" speed claim. Even so, B still wins on **3 of the 4 heaviest drivers** below (authz provability, monorepo-law, exit cost) and **ties** geo; A's two genuine wins (realtime ops, greenfield demo speed) are bought back with managed services.
- **The linchpin open question becomes:** *is the team's primary fluency Nest/Prisma/Socket.IO/Jest?* If yes → B holds. If the team is actually stronger in SQL/PL-pgSQL/Deno, the recommendation flips toward A. This is the first thing to confirm.

---

## Decision drivers

1. **Hard problem 1 — race-safe per-branch stock:** provably atomic (exactly-1-of-20, qty never negative) **and** maintainable as the reservation state machine grows (TTL sweep, multi-item, sagas).
2. **Hard problem 2 — geo branch-routing:** PostGIS containment + priority/distance tie-break; net-new for this team on **either** path.
3. **Hard problem 3 — realtime:** channel-per-branch/order, throttled courier pings, reconnect-refetch; explicitly an optimization over REST, so no delivery guarantees needed.
4. **Speed-to-first-demo** for a small senior team — measured against this team's fluency, not a generic team.
5. **Data-layer branch-scoped RBAC across 4 roles proven with negative tests** — the requirement is *provability*, not just enforcement.
6. **Long-term ops burden, maintainability of the transactional core, vendor lock-in / exit cost** over a multi-branch lifetime.
7. **Monorepo law:** `packages/shared` Zod as the single source of truth across mobile + web + server, zero duplicated shapes.

---

## Options

### Option A — Supabase
Managed Postgres + RLS + Realtime (logical replication / Broadcast) + phone OTP Auth + Storage; server-authoritative logic in Deno Edge Functions + PL/pgSQL; geo via PostGIS in an Edge Function. Near-free auth/realtime/storage/RLS on day one.

**Pros**
- Race-safe stock is machine-provable with minimal surface: one PL/pgSQL RPC = one transaction co-located with data; `UPDATE … WHERE qty_available >= n RETURNING` serialized by the Postgres row lock; `CHECK` enforces the invariant; no Redis, no retry loop.
- Realtime is essentially free and **post-commit by construction** (no phantom events on rollback); Broadcast is the right primitive for ephemeral throttled courier pings without touching the WAL.
- RLS enforces branch scoping as a property of the **row** — fails closed even if app code has a bug; the strongest data-layer authz primitive.
- Fastest to first demo **for a generic team** — OTP, Storage, Realtime, RLS need no plumbing.
- Lowest infra to operate at small scale; managed everything including PostGIS.

**Cons**
- Team has **no demonstrated** Deno/PL-pgSQL/RLS fluency; for this team these are net-new authoring **and** testing surfaces learned during the demo crunch.
- The most security/integrity-critical logic (RLS policies, SQL functions) **cannot import `packages/shared` Zod** → a second source of truth on the security-critical path → directly violates monorepo-is-law.
- Negative authz tests against RLS need role-impersonating SQL connections (`set_config request.jwt.claims`) — awkward, slow, under-practiced, so RLS regressions ship unnoticed; *provability* is weakest exactly where the brief demands it.
- RLS policy sprawl across every table × role × operation; branch-scoped joins push into `SECURITY DEFINER` helpers that are easy to make silently over-permissive.
- Signed Paymob webhook + idempotent checkout in Deno (unfamiliar runtime, raw-body/HMAC, cold starts) splits business logic across SQL + Deno → harder incident debugging.
- High, concentrated **exit cost**: leaving Supabase means rewriting RLS as guards, Edge Functions as services, and replacing Realtime — the load-bearing pieces.
- All-orders HQ firehose over RLS-checked logical replication is the least-bounded channel and Supabase Realtime's documented hot spot.

### Option B — NestJS + Prisma + Postgres (recommended)
NestJS modular monolith + Prisma + Postgres + PostGIS; data-layer RBAC via guards; Socket.IO gateway **or** managed realtime (Ably/Pusher); idempotent checkout + signed Paymob webhook in controllers; reservation via interactive `$transaction` with row-lock / conditional `UPDATE` + `CHECK`. Recommended with **managed PostGIS-capable Postgres** (Neon/RDS/Crunchy) and **managed realtime** for v1.

**Pros**
- Branch-scoped RBAC across 4 roles is **one explicit, greppable, PR-reviewable TS layer** (`req.user.{role,branchId}` + Prisma `where:{branchId}`); negative tests are ordinary fast deterministic CI integration tests — *provability is far higher*, which is the actual requirement.
- `packages/shared` Zod is unambiguously the single source: end-to-end TS, `nestjs-zod` feeds server validation, same schemas imported by Expo + Vite; **no SQL/RLS second source**.
- Race-safe stock is identically correct using DB-native row-locking / conditional `UPDATE` + `CHECK` **inside** a `$transaction`; the 20-concurrent test passes on both paths. **Redis distributed lock is NOT needed and is explicitly rejected** (Redlock has no fencing token — an incorrectness anti-pattern). The DB is the only arbiter of stock.
- Heavy custom business logic (promo math, multi-item reservation, TTL sweep, payment/courier sagas) lives in unit-testable TS, not sprawling PL/pgSQL — cheaper correctness as the domain grows.
- **Near-zero exit cost:** vanilla Postgres dump + a Node app runs on any host; no concentrated lock-in.
- Paymob webhook + idempotency are bread-and-butter Node: raw-body HMAC, `UNIQUE(idempotency_key)`, single transaction, clear runbooks.
- Team fluency (per git history) is exactly this stack on a Jest/Supertest harness they operate fluently.

**Cons**
- Slower than Supabase **for a hypothetical greenfield team** — you build OTP (SMS provider), image storage (S3/R2 + signed URLs), and the realtime transport before fully exercising surfaces (mitigated by managed building blocks).
- More components to keep in dev/staging/prod parity (Node app + managed PG + SMS + object storage + realtime vendor) — a small team can drown in undifferentiated plumbing.
- Self-hosted Socket.IO needs sticky sessions + Redis adapter to scale horizontally and its own per-channel authz tested separately — **or** a recurring Ably/Pusher bill + second vendor.
- The portability/provability advantage is **conditional on discipline** — it evaporates if the team skips the negative authz tests or the Zod-as-law rule.
- PostGIS geo-routing is genuinely net-new (prior concurrency was temporal) — the likeliest Phase-0 slip, though equally new on Path A.

---

## Decision

**Adopt Path B (NestJS + Prisma + Postgres)**, provisioned with a **managed PostGIS-capable Postgres** (Neon/RDS/Crunchy) and **managed realtime** (Ably/Pusher) for v1 — explicitly buying back Path A's only durable advantage (free realtime/auth/storage/ops) without re-platforming the transactional core.

**Why (resolving the panel rather than averaging it):**
- **Hard problem 1 (stock):** Both paths terminate at the same Postgres mechanism (row-lock + conditional `UPDATE … WHERE qty_available >= n` + `CHECK`). Same correctness; the 20-concurrent test passes on both. The Correctness lens (which voted A) *concedes its verdict flips* once reservation grows into TTL sweepers, multi-item, and payment/inventory/courier sagas — which a hypermarket will. B wins maintainability there. We **reject Redis/Redlock for stock**; the DB is the arbiter.
- **Hard problem 2 (geo):** A genuine **tie** — identical PostGIS query on identical Postgres, net-new on both. Not a tiebreaker.
- **Hard problem 3 (realtime):** Path A's strongest, most honest advantage; conceded on a greenfield basis. Neutralized by (a) team fluency with namespaced role-gated Socket.IO rooms and (b) the optimization-over-REST framing (TanStack Query reconnect-refetch). Residual ops gap closed by **managed realtime for v1** — authz becomes a token-signing endpoint in Nest.
- **Speed-to-demo:** The only lens that read the repo (Velocity) found Phase-0 is mostly reuse of code with green specs on a familiar harness; A forces net-new Deno + PL/pgSQL + RLS during the crunch. *Familiarity beats free.* (This is the claim most affected by the greenfield caveat — see above.)
- **RBAC provability:** The brief's literal requirement is *provability*. RLS is the stronger *enforcement* primitive but the weaker *provability* story and the bigger lock-in/sprawl liability. B gives one explicit TS authz layer with fast deterministic negative tests. We add Postgres RLS on `orders`/`payments` only as cheap **defense-in-depth**, not the primary mechanism.
- **Monorepo law:** Both A-voting lenses still scored shared-schemas for B, because RLS/SQL cannot import `packages/shared` Zod. A direct violation of a stated requirement, counted against A regardless of lens.
- **Long-term:** A's exit cost is high and concentrated in the load-bearing pieces; B's is near-zero. Over a multi-branch lifetime, portability dominates.

Net: **B wins 3 of the 4 weightiest drivers** (stock-at-scale maintainability, authz provability, monorepo law, exit cost) and **ties geo**; A's two genuine wins (realtime ops, greenfield demo speed) are neutralized by team fluency + managed services. **Confidence 0.76** — deliberately below the velocity lens's 0.78 to reflect the conceded realtime-ops cost and the discipline-dependence of B's payoff.

---

## Consequences

**Positive**
- Phase-0 is mostly familiar-stack work on a Jest/Supertest harness — fastest path to green spikes for this team.
- One explicit, greppable, PR-reviewable TS authorization layer; negative authz tests are fast deterministic CI gates that make branch scoping *provable*.
- `packages/shared` Zod is the unambiguous single source end-to-end (Expo + Vite + Nest via `nestjs-zod`).
- Heavy business logic stays in unit-testable TS as the domain grows.
- Near-zero exit cost; managed PostGIS + managed realtime remove the heaviest undifferentiated plumbing while the transactional core stays portable.

**Negative**
- More components to operate and keep in dev/staging/prod parity than Supabase's single platform.
- Recurring Ably/Pusher bill (or later the burden of self-hosting Socket.IO + Redis adapter) as a deliberate v1 cost trade.
- Slower than Supabase for a hypothetical greenfield team; the win depends on team fluency and on **not** skipping the disciplines.
- We forgo Supabase's free auth/storage/realtime and its post-commit-by-construction realtime correctness guarantee.

**Risks & mitigations**

| Risk | Mitigation |
|---|---|
| PostGIS geo-routing is net-new (likeliest Phase-0 slip) | Spike geo **first**: PostGIS + `delivery_zones(geography)` + a Prisma `$queryRaw` resolver (`ST_Contains`, `ORDER BY priority then ST_Distance`, GiST index, reject-outside) before feature work |
| Reuse temptation: lifting the booking *slot* pattern mis-models stock | Model stock as an explicit inventory **ledger** with `CHECK(qty_available>=0)` & `CHECK(qty_reserved>=0)`; reuse the race **pattern**, not the slot **data model**; conditional `UPDATE … WHERE qty_available>=n` in a `$transaction`; permanent 20-concurrent CI regression test |
| Self-hosted realtime ops (sticky sessions, Redis adapter, separate authz) | Managed realtime (Ably/Pusher) for v1; authz = a Nest token-signing endpoint under the same negative-authz suite; realtime strictly an optimization over REST so a dropped event degrades to slightly-stale UI, never wrong state |
| Provability advantage evaporates if disciplines are skipped | Make the negative-authz matrix + the 20-concurrent stock test **CI gates** from Phase-0; forbid Prisma-derived types leaking to clients so Zod stays the single source |
| Dropping the Redis lock without losing race safety | Rely solely on the DB: row-lock / conditional `UPDATE` + `CHECK` in `$transaction`; Redis only for ephemeral pub/sub fan-out, never a stock lock |
| Splitting reservation across round-trips loses atomicity | Keep reservation + order-insert + idempotency-key write in **one** interactive `$transaction`; idempotency via `UNIQUE(idempotency_key)` returning the existing order on replay; `payment_status` mutated server-side only after Paymob HMAC verify |

---

## Revisit triggers

- The all-orders firehose must scale to very high network-wide write rates, or courier tracking must support thousands of concurrent couriers with sub-second region-fanned updates → re-evaluate self-hosted Socket.IO + Redis sharding.
- Managed realtime (Ably/Pusher) recurring cost becomes material → revisit self-hosting Socket.IO with a Redis adapter.
- The team's senior fluency turns out to be SQL/PL-pgSQL/Deno rather than Nest/Prisma/Socket.IO/Jest → **flips the speed argument toward A**.
- Speed-to-first-demo becomes the single dominant business risk over an ~8-week window **and** no existing asset can be leveraged → A's free auth/realtime/storage would win Phase-0.
- Reservation logic stays permanently narrow (no TTL/multi-item/sagas) **and** ops headcount stays minimal → the case for Supabase's single managed surface strengthens.
- Vendor coupling on managed realtime/PostGIS host becomes a constraint → confirm the thin client adapter + standard Postgres keep exit cost near-zero.

---

## Open questions for the user (confirm before scaffolding)

1. **Linchpin:** Is the team's primary fluency **Nest/Prisma/Socket.IO/Jest**? (If false, reconsider toward A.)
2. **Managed realtime:** Approve **Ably or Pusher** for v1 (recurring cost, second vendor) vs. self-hosting Socket.IO + Redis adapter from day one? *Recommend managed for v1.*
3. **Managed Postgres host** with native PostGIS + PITR: **Neon, AWS RDS, or Crunchy**? (Needed before any geo spike.)
4. **Zod-as-law via `nestjs-zod`** (the prior server used class-validator DTOs) so `packages/shared` is the single source feeding server validation + both clients — confirm this deliberate switch.
5. **Drop the Redis distributed *lock* for stock entirely** (DB row-lock + `CHECK` only); Redis, if present, is ephemeral pub/sub only — confirm.
6. **SMS/OTP provider for Egypt:** Twilio Verify vs. a local Egyptian SMS gateway (deliverability/cost/regulatory)?
7. **Image storage target:** S3 vs. Cloudflare R2 (signed URLs behind a thin Nest module)?
8. **Phase-0 gating order:** geo spike **first**, then the 20-concurrent reservation test and the negative-authz matrix as CI gates before feature work — confirm.
9. **Single-region Egypt deployment** assumption for now (affects realtime/geo scaling and pooler config) — confirm.
10. **Reservation modeled as an explicit inventory LEDGER** (available/reserved/fulfilled debit-credit), not a slot, before scaffolding the schema — confirm.
