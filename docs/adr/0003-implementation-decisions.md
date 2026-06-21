# ADR-0003: Implementation decisions & deviations (Phases 0–4 build)

- **Status:** Accepted (2026-06-18)
- **Context:** Decisions taken while building, in a sandbox with **no Docker, no managed cloud, no device/emulator**. Each keeps the workspace green and honest about what is verified vs. external.

## Decisions

1. **Test DB substrate = `embedded-postgres`** (real PostgreSQL 18.4 in-process, no Docker/admin). Forced **UTF-8 / `--no-locale`** at initdb (Windows defaults to WIN1252, which rejects Arabic — fatal for an Arabic-first product). Gives real connections, row-locking, and transactions for the oversell/realtime/authz proofs.

2. **Schema applied in tests via the Prisma-generated DDL + `extras.sql`** (CHECK constraints + `customer_catalog` view) over a `pg` connection, rather than spawning `prisma db push` per run. `prisma/init.sql` is regenerated from `schema.prisma` via `prisma migrate diff` and doubles as the production migration; `extras.sql` holds what Prisma's DSL can't express.

3. **PostGIS deferred (documented, not skipped).** embedded-postgres has no PostGIS, so S2 / `RoutingService` resolve containment + distance in code; the production `ST_Covers`/`ST_Distance` query is written and documented (`packages/db/src/routing.ts`, ADR-0002). Swap-in when the managed PostGIS host lands.

4. **Realtime transport = Postgres `LISTEN/NOTIFY`** for the spike + API (`pg_notify` is transactional ⇒ post-commit by construction). Production swaps to managed realtime / Socket.IO behind the same `OrderStatusEvent` contract + channel-per-order (ADR-0001/0002).

5. **No Redis stock lock** — the DB is the sole arbiter (atomic conditional `UPDATE … WHERE qty_available>=n` + CHECK). Redlock has no fencing token; rejected per ADR-0001.

6. **Reservation kept inside one interactive `$transaction`** with the idempotency key's unique index serializing double-submits (exactly-once). Price is recomputed server-side from active+listed+priced (independent of stock, so depletion surfaces as `OUT_OF_STOCK`, not "unavailable").

7. **API tests instantiate services directly** against the embedded PrismaClient (fast, deterministic) + a supertest **e2e** that boots the real Nest app (DI + guard + controllers). Vitest runs NestJS via `unplugin-swc` (decorator metadata).

8. **API tsconfig = `node16` module/resolution** (reads `@hyper/shared` `exports` maps, emits CJS for Nest). `@hyper/shared` `exports` use **per-condition `types`** (`.d.ts` for import, `.d.cts` for require) so CJS consumers resolve correctly. **Build via `tsc`** (not the Nest CLI) to avoid an extra heavyweight dependency.

9. **Customer app split:** the shared-consuming **logic** (cart store, checkout view-model, status presenter) is a verified workspace package (tests + typecheck in CI); the **Expo RN screens** under `apps/customer/app/` are real reference code excluded from the verified typecheck, because the Expo runtime + Metro-on-pnpm can only be meaningfully verified on a device/emulator (Plan §8). See `apps/customer/README.md`.

10. **Dashboard pinned `@vitejs/plugin-react@4`** (v6 requires Vite 7's `./internal`; the workspace uses Vite 6).

## Built since (closing earlier gaps)
- **Promotions** are now applied + **server-enforced at checkout** (pct/fixed, window + min-subtotal) with an HQ create endpoint — `promotions.spec.ts`.
- **Courier assignment** (same-branch enforced) + **returns/refund** (delivered→refunded, payment refunded, **stock restocked**) — `delivery.spec.ts`.
- **Loyalty points** (Phase 5): earn-on-deliver / reverse-on-return + balance endpoint — `loyalty.spec.ts`.
- Dashboard **operator OrderActions** (legal next-states from the shared machine) + **catalog-admin** write page.

## Known tech-debt / follow-ups
- Small geo math (`pointInPolygon`/`haversine`) is duplicated in `@hyper/db` and `apps/api` — consolidate into a shared `geomath` module when graduating S2 to PostGIS.
- BOGO promotions are line-level — treated as 0 for now; wire in pricing polish.
- Shared status labels (Arabic) exist in `StatusPill` (web), the customer presenter, and `OrderActions` — fold into one shared map.
- Courier live-location streaming + richer operator screens (pick/pack checklist, zone editor map) are next dashboard polish.
