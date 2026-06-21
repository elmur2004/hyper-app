# Project Status — Hypermarket E-Commerce & Delivery Platform

_Last updated: 2026-06-18_

## Current state: **Phases 0–4 built and verified end-to-end (local), green across the workspace**

Backend path **B (NestJS + Prisma + Postgres)** — ADR-0001 Accepted. Whole-workspace gates:
**typecheck 6/6 · lint 6/6 · build 3/3 · 106 tests passing** (real Postgres via embedded-postgres).

```
pnpm -w typecheck   # 6/6
pnpm -w lint        # 6/6
pnpm -w test        # shared 42 · db 19 · api 36 · dashboard 5 · customer 4  = 106
pnpm -w build       # shared (tsup) · api (tsc) · dashboard (vite)
```

Now also includes: **promotions** at checkout (server-enforced), **courier assignment + returns/refund** (restock), **loyalty points** (Phase 5: earn-on-deliver / reverse-on-return), and dashboard **operator order-actions** (legal transitions from the shared machine) + **catalog-admin** write page.

## Repository layout
```
packages/shared   @hyper/shared  — §4 Zod schemas, order status machine, §9 theme tokens,
                                    RTL UI primitives, typed API client (the "law")
packages/db       @hyper/db      — the three Phase-0 spikes (S1/S2/S3) + embedded-postgres harness
apps/api          @hyper/api     — NestJS + Prisma: catalog/orders/checkout/admin/payments/auth
apps/dashboard    @hyper/dashboard — React+Vite Central Command (RBAC routing, orders firehose, catalog)
apps/customer     @hyper/customer  — verified cart/checkout/status logic + Expo RN screens (reference)
docs/             plan, ADRs, breakdown, demo scripts, status
.github/          CI (typecheck+lint+test+build on every PR) + branch-protection guide
```

## Done — with acceptance evidence (test files)

### Phase 0 — foundation & de-risk
- ☑ Monorepo (pnpm + Turborepo), strict TS, flat ESLint/Prettier, CI.
- ☑ `@hyper/shared`: every §4 entity (branded IDs, integer piastres), order status machine (exhaustive), theme tokens + `cssVars`/RTL, 6 RTL UI primitives, typed API client. _Evidence:_ **42 tests / 10 files**.
- ☑ **S1 oversell** — 20/100/**1000** concurrent for stock=1 → exactly 1 success + 50× flake. `db/inventory.spike.test.ts`
- ☑ **S2 geo routing** — containment + priority/distance + reject-outside (PostGIS query documented). `db/routing.spike.test.ts`
- ☑ **S3 realtime** — post-commit push, version dedup, negative-authz isolation, reconnect→1 refetch, p95≈13ms/50. `db/realtime.spike.test.ts`

### T0.3 — schema/RBAC/seed (graduated into the API)
- ☑ Prisma §4 schema + generated DDL + `extras.sql` (CHECK constraints + `customer_catalog` view). `api/test/smoke.spec.ts`
- ☑ `customer_catalog` visibility predicate (active∧listed∧in-stock∧priced). `api/test/catalog-routing-inventory.spec.ts`, `admin.spec.ts`
- ☑ Branch-scoped RBAC + audit_log. Negative authz proven (below).

### Phase 1 — customer golden path (COD)
- ☑ OTP auth, addresses, catalog read, **checkout** (route→branch, server price recompute, atomic reservation, idempotency), tracking, history, reorder, status machine (cancel releases / deliver fulfills). _Evidence:_ `api/test/orders.spec.ts` — golden path, **price integrity**, **oversell-in-checkout**, **idempotency**, **negative authz** (cross-customer 404 / cross-branch 403), illegal-transition rejection, **live realtime status**.

### Phase 2 — Central Command (HQ)
- ☑ Master catalog CRUD, **visibility kill-switch** (reflects in customer catalog live), per-branch listing, stock control, pricing, **promotions** (created by HQ, **server-enforced at checkout**: pct/fixed, window + min-subtotal validation), reports — all RBAC-gated (only HQ-admin edits master catalog/prices) + audit_log. _Evidence:_ `api/test/admin.spec.ts`, `api/test/promotions.spec.ts`.

### Phase 3 — Branch Operations
- ☑ Branch-scoped realtime order queue, pick/pack/confirm via the status machine, **courier creation + assignment** (same-branch enforced), **returns/refund** (delivered→refunded, payment refunded, **stock restocked**), reports. _Evidence:_ `api/test/orders.spec.ts`, `api/test/delivery.spec.ts`. Dashboard operator drives transitions inline via `OrderActions` (legal next-states from the shared machine) — `dashboard/OrderActions.test.tsx`.

### Phase 4 — payments + hardening foundations
- ☑ `PaymentProvider` interface, **COD first-class**, **signed Paymob webhook verification**, **idempotent server-only `payment_status`**. _Evidence:_ `api/test/payments.spec.ts`. Sentry placeholders (dashboard) + env split wired.

### The real Nest app runs (E2E)
- ☑ `api/test/e2e.spec.ts` — boots the app via supertest: public catalog, OTP→address→COD checkout over HTTP, 401 on unauthenticated, 400 via the shared Zod pipe.

### Surfaces
- ☑ **Dashboard** (Vite): RBAC routing, orders firehose (TanStack Query), catalog, login — consuming `@hyper/shared` client/ui/theme. typecheck + component test + `vite build` green.
- ☑ **Customer**: cart store, checkout view-model, status presenter, shared client — **logic verified** (`customer/src/cart.test.ts`). Expo RN screens are documented reference (`apps/customer/README.md`).

## Requires external resources (documented, not runnable in this sandbox)
- **Managed PostGIS** (Neon/RDS/Crunchy): swap S2's in-code resolver for the documented `ST_Covers`/`ST_Distance` query (`packages/db/src/routing.ts`).
- **Managed realtime** (Ably/Pusher) for v1, or self-hosted Socket.IO — behind the existing `OrderStatusEvent`/pg_notify contract.
- **Paymob live keys** (`PAYMOB_API_KEY`): wire `createIntent` + the exact HMAC field ordering (verification mechanism already proven).
- **SMS/OTP provider** (Twilio/local EG gateway): dispatch the OTP (currently returned as `devCode` in non-prod).
- **Image storage** (S3/Cloudflare R2): signed URLs behind a thin module.
- **Expo toolchain + device/emulator**: build/run the customer RN screens; Detox/Maestro golden-path E2E (Plan §8 device matrix). EAS Build/Submit for store delivery.

## Phase 5
- ☑ **Loyalty points** — earned on delivery (1 pt/EGP), reversed on return; balance endpoint. _Evidence:_ `api/test/loyalty.spec.ts`.
- ⏳ Deferred (post-launch, per plan): in-app support chat, web storefront, smart recommendations/offers.

## ADRs
- [0001](adr/0001-backend-choice.md) backend = NestJS (Accepted) · [0002](adr/0002-phase0-spikes.md) spike outcomes (Accepted) · [0003](adr/0003-implementation-decisions.md) implementation decisions/deviations (Accepted).

## Acceptance evidence log (§11 gates)
| Gate | Evidence | Status |
|---|---|---|
| Oversell (20/1000 → exactly 1; never negative) | `db/inventory.spike.test.ts`, `api/orders.spec.ts` | ✅ |
| Routing (in-zone/overlap/outside) | `db/routing.spike.test.ts`, `api/catalog-routing-inventory.spec.ts` | ✅ |
| Live-update + reconnect refetch | `db/realtime.spike.test.ts`, `api/orders.spec.ts` | ✅ |
| Authz negative (cross-customer/cross-branch/only-admin-edits) | `api/orders.spec.ts`, `api/admin.spec.ts` | ✅ |
| Price integrity (server recompute) | `api/orders.spec.ts` | ✅ |
| Idempotency (double-submit → one order) | `api/orders.spec.ts` | ✅ |
| Golden-path (browse→checkout→track→delivered) | `api/orders.spec.ts`, `api/e2e.spec.ts` | ✅ |
| Payment via signed webhook (server-only, idempotent) | `api/payments.spec.ts` | ✅ |
| Visibility control reflects live | `api/admin.spec.ts` | ✅ |
| Promotions server-enforced (pct/expired/min) | `api/promotions.spec.ts` | ✅ |
| Courier assign (same-branch) + return restock+refund | `api/delivery.spec.ts` | ✅ |
| Loyalty earn-on-deliver / reverse-on-return | `api/loyalty.spec.ts` | ✅ |
| Operator legal-transition UI from shared machine | `dashboard/OrderActions.test.tsx` | ✅ |
