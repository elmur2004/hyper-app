# Demo scripts — proving each phase's acceptance gate

All commands run from the repo root. First time: `pnpm install` (pnpm 9.15.4, Node 22).
Tests boot a real Postgres in-process (`embedded-postgres`) — no Docker needed.

## Whole-workspace gates
```bash
pnpm -w typecheck   # 6/6 packages
pnpm -w lint        # 6/6
pnpm -w test        # 94 tests (shared 42 · db 19 · api 27 · dashboard 2 · customer 4)
pnpm -w build       # shared (tsup) · api (tsc) · dashboard (vite)
```

## Phase 0 — the three hard problems
```bash
pnpm --filter @hyper/db test
```
Proves: **S1** 20/100/1000 concurrent orders for stock=1 → exactly one success + 50× flake;
**S2** in-zone / priority-overlap / distance-overlap / outside; **S3** push + version dedup +
negative-authz isolation + reconnect→1 refetch + p95 latency.

## Phase 1 — customer golden path (COD)
```bash
pnpm --filter @hyper/api test test/orders.spec.ts
```
Proves: browse→checkout→track→delivered; server price recompute (tampered hint ignored);
oversell-in-checkout (one order, one OUT_OF_STOCK); idempotent double-submit; illegal
transition rejected; cancel releases stock; cross-customer 404 / cross-branch 403; live status.

## Phase 2 — Central Command (HQ)
```bash
pnpm --filter @hyper/api test test/admin.spec.ts test/promotions.spec.ts
```
Proves: only HQ-admin edits master catalog/prices; manager scoped to own branch; audit_log
written; HQ unpublish removes a product from the customer catalog **live**; promotions are
**server-enforced at checkout** (pct/fixed, expiry + min-subtotal, total recomputed server-side).

## Phase 3 — Branch Operations (courier + returns)
```bash
pnpm --filter @hyper/api test test/delivery.spec.ts
```
Proves: same-branch courier assignment (cross-branch denied); returns on a delivered order →
refunded + payment refunded + **stock restocked**; cannot return a non-delivered order.
Dashboard operator UI: `pnpm --filter @hyper/dashboard test` (legal next-states from the shared machine).

## Phase 5 — loyalty
```bash
pnpm --filter @hyper/api test test/loyalty.spec.ts
```
Proves: points earned on delivery (1/EGP) and reversed on return.

## Phase 4 — payments
```bash
pnpm --filter @hyper/api test test/payments.spec.ts
```
Proves: COD → no online intent; bad signature rejected (stays `pending`); correctly-signed
webhook marks `paid` (server-side only); replay is an idempotent no-op.

## The real Nest app over HTTP
```bash
pnpm --filter @hyper/api test test/e2e.spec.ts
```
Boots the app (DI + guard + controllers + Prisma) via supertest: public catalog,
OTP→address→COD checkout, 401 unauthenticated, 400 via the shared Zod pipe.

## Run it locally (against your own Postgres)
```bash
# 1. Point at a Postgres (any v14+; PostGIS optional until S2 graduates)
export DATABASE_URL=postgresql://USER:PASS@HOST:5432/hyper
# 2. Apply schema + extras
psql "$DATABASE_URL" -f apps/api/prisma/init.sql
psql "$DATABASE_URL" -f apps/api/prisma/extras.sql
# 3. Generate client, build, run
pnpm --filter @hyper/api exec prisma generate
pnpm --filter @hyper/api build && pnpm --filter @hyper/api start   # API on :3000
# 4. Dashboard (separate shell)
VITE_API_URL=http://localhost:3000 pnpm --filter @hyper/dashboard dev
# Staff login on the dashboard uses a seeded phone, e.g. +201111111100 (HQ admin) after seeding.
```

## Customer app (Expo) — see apps/customer/README.md
The cart/checkout/status logic is verified here; building/running the RN screens needs the
Expo toolchain + a device/emulator (out of scope for this environment).
