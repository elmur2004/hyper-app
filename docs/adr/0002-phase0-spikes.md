# ADR-0002: Phase-0 spike outcomes (the three hard problems)

- **Status:** Accepted (2026-06-18)
- **Context:** Plan §1.4 / §10 require the three hard problems to be de-risked *first*, with demonstrable acceptance tests (§11). This ADR records the mechanisms proven and the decisions taken.
- **Backend:** Path B (NestJS + Prisma + Postgres) — see [ADR-0001](0001-backend-choice.md).

## Test substrate decision

This machine has **no Docker and no local Postgres**. Per the user's choice, the spikes run against **`embedded-postgres`** — a real PostgreSQL binary (PG 18.4) booted in-process, no Docker/admin. This gives **real connections, real row-locking, and real transactions** (essential for the oversell proof). Tests live in `packages/db` and reuse a shared harness (`startTestDb`). Limitation: embedded-postgres ships **without PostGIS**, which shapes the S2 decision below.

## S1 — Race-safe per-branch stock (oversell) ✅

- **Mechanism:** a single server-authoritative **atomic conditional UPDATE** — `UPDATE inventory SET qty_available = qty_available - n, qty_reserved = qty_reserved + n WHERE … AND qty_available >= n RETURNING …` — success ⇔ `rowCount === 1`. Postgres serializes concurrent writers on the row lock and re-checks the predicate, so exactly one of N racers wins. `CHECK (qty_available >= 0)` / `CHECK (qty_reserved >= 0)` make the invariant un-violable at the DB. Symmetric `cancel` (reserved→available) and `fulfill` (decrement reserved).
- **Decision:** **No Redis distributed lock** — the DB is the sole arbiter (Redlock has no fencing token; an incorrectness anti-pattern). Confirms ADR-0001.
- **Evidence (`packages/db/src/inventory.spike.test.ts`):** 20 / 100 / **1000** concurrent place-orders for `stock=1` → **exactly 1 success, the rest clean `OUT_OF_STOCK`**, final `available=0/reserved=1`, no negative stock; **50 repeated rounds** of 20-concurrent with no flakiness. 1000-concurrent completes in ~360ms.

## S2 — Geo branch-routing ✅ (logic proven; PostGIS query documented)

- **Mechanism proven now:** zones stored DB-backed (`branches` + `delivery_zones` with JSONB polygons); the resolver does point-in-polygon containment + haversine distance, ranks by **priority DESC then distance ASC then stable id**, and returns `not_deliverable` outside all zones. Request/response is the shared `ResolveZone` contract.
- **PostGIS deferred (not abandoned):** embedded-postgres has no PostGIS, so the production spatial query is written and documented as `PRODUCTION_POSTGIS_RESOLVER` in `packages/db/src/routing.ts` (`ST_Covers` + `ST_Distance` over GiST indexes). **Swap-in once the managed PostGIS host exists** (ADR-0001 open question: Neon/RDS/Crunchy). The contract and tie-break order are identical.
- **Evidence (`packages/db/src/routing.spike.test.ts`):** point in one zone → that branch; differing-priority overlap → higher-priority branch; **equal-priority overlap → nearer branch**; outside all zones → `not_deliverable`; deterministic across runs.
- **Follow-up:** authenticate/RBAC-scope the resolver endpoint; `audit_log` on zone writes; MultiPolygon + on-boundary handling; cache point→branch with invalidation on zone edits.

## S3 — Live order status + reconnect ✅

- **Mechanism:** transactional status advance (re-check + version bump inside a tx, validated by the shared **order status machine**), then **post-commit publish** on **channel-per-order**. The client applies a push to its cache **only if `version` advances** (drops stale/replayed events) and **never refetches on a normal push**; on reconnect it fires **exactly one** authoritative refetch (TanStack Query `refetchOnReconnect`) that converges to server truth.
- **Transport decision:** spike uses Postgres **`LISTEN/NOTIFY`** — `pg_notify` is transactional, so events deliver only on COMMIT (**post-commit by construction**, no phantom events on rollback). **Production swaps the transport for managed realtime / Socket.IO rooms** (ADR-0001), keeping the same `OrderStatusEvent` contract + channel-per-order.
- **Evidence (`packages/db/src/realtime.spike.test.ts`):** push applied without a manual refetch within SLA; stale/replayed event ignored (version dedup); **negative authz** — a customer cannot subscribe to / read another customer's order and receives **zero** of its events; reconnect after an offline transition triggers **exactly one** refetch and recovers the missed state. **SLA: p50 ≈ 10ms, p95 ≈ 13ms, p99 ≈ 18ms over 50 transitions** (gate ≤ 2000ms).

## Consequences / follow-ups for the real build (T0.3+)

- Port the S1 atomic UPDATE + reservation lifecycle into the NestJS `InventoryService` inside a Prisma `$transaction`; keep the 1000-concurrent test as a permanent CI gate.
- Model stock as the explicit ledger (available/reserved/fulfilled), not a slot.
- Provision a managed PostGIS Postgres to graduate S2's resolver to `ST_Covers`/`ST_Distance`.
- Wire managed realtime (Ably/Pusher) behind the `OrderStatusEvent` contract; keep realtime strictly an optimization over REST.
