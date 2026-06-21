# Phase-0 — Foundation & De-risk: Task Breakdown with Acceptance Tests

> Phase-0 goal (Plan §10): prove the **three hard problems** before building features, and stand up the monorepo + shared package + schema so the rest can be built on a real foundation. Each work item below ends with a **demonstrable exit gate** mapped to Plan §11.
>
> **Backend path is not yet committed.** Tasks are written backend-agnostic at the task level; each work item carries `Path A` / `Path B` implementation notes. ADR-0001 recommends **Path B (NestJS)** — pending your confirmation. The geo spike (S2) should run **first** per the ADR's top risk.
>
> Status legend: ☐ not started. Nothing here is built yet.

---

## Suggested execution order

1. **T0.1** Monorepo + CI (foundation everything else needs)
2. **T0.2** `packages/shared` Zod schemas + theme + primitives (the "law")
3. **T0.3** DB schema migration + RBAC scaffold + `customer_catalog` view + seed
4. **S2** Geo zone-resolution spike (ADR's likeliest slip — do early)
5. **S1** Oversell-safe stock reservation spike (the headline gate)
6. **S3** Realtime status push + reconnect-refetch spike

**Phase-0 closes when:** all three spikes (S1/S2/S3) pass their acceptance tests in CI, T0.1–T0.3 exit gates are green, and ADR-0001 is accepted.

---

## T0.1 — Monorepo, workspaces & CI

**Objective:** pnpm + Turborepo skeleton — `apps/customer` (Expo RN, TS), `apps/dashboard` (React+Vite, TS), `packages/shared` (the single source of truth). Shared TS project references, one eslint/prettier/tsconfig baseline, typed env split per dev/staging/prod, RTL/Arabic readiness, Sentry placeholders, and a GitHub Actions pipeline that runs typecheck+lint+test on every PR and **blocks merge** on failure. Backend-path-agnostic.

**Exit gate:** on a fresh clone, `pnpm install && pnpm -w typecheck && pnpm -w lint && pnpm -w test` passes; `pnpm --filter dashboard dev` serves Vite and `pnpm --filter customer start` boots Expo; both apps render a screen that imports & validates a Zod schema from `packages/shared`; a PR with a type/lint/test error shows a **RED required check and is blocked**, a clean PR is GREEN/mergeable.

| Task | Acceptance test (given → when → then) | Auto | Est |
|---|---|---|---|
| **T0.1.1** Bootstrap pnpm + Turborepo skeleton (3 packages, root scripts, gitignore, remove legacy `client/`+`server/`) | clean checkout, no node_modules → `pnpm install` then `pnpm -w build` twice → single lockfile resolves, first build runs all tasks, second reports `FULL TURBO` cache hits | ✅ | M |
| **T0.1.2** Shared `tsconfig.base` + TS project references + base eslint/prettier | `packages/shared` referenced by both apps → introduce a type error in an exported shared symbol, run `pnpm -w typecheck` → fails for shared **and both consuming apps** (transitive); lint clean on baseline; revert → all pass | ✅ | M |
| **T0.1.3** `packages/shared` as the single Zod source, consumed by both apps (cross-surface proof) | seed schema (Role enum + one domain schema) exported → dashboard (Vite) + customer (Metro/Expo) each import & `safeParse` valid/invalid, run `--filter shared test` → both bundlers resolve with no duplicate-React errors, screens show valid/invalid states, unit tests pass | ✅ | M |
| **T0.1.4** Typed, Zod-validated env split per dev/staging/prod for both apps | Zod env loader + profiles → start with a required public var missing, and separately reference a secret-looking (non `VITE_`/`EXPO_PUBLIC_`) var in app source → startup throws naming the missing key; secret-leak guard fails (secrets cannot be bundled) | ✅ | M |
| **T0.1.5** GitHub Actions CI (typecheck+lint+test) wired to branch protection | CI on `pull_request` + protection requiring those checks → open a PR with a type/lint/test error, and a clean PR → broken PR RED & merge **blocked**; clean PR GREEN & mergeable | ✅ | M |
| **T0.1.6** Sentry placeholders (both surfaces) + RTL/Arabic baseline | Sentry init DSN-guarded + error boundary + RTL baseline → a child throws on each surface (capture mocked) → boundary catches, mocked capture called once, **localized Arabic fallback renders RTL**, no-DSN init is a safe no-op | ✅ | M |

**Path A note:** `packages/shared` also hosts generated Supabase types + hand-written Zod mirrors; env carries `SUPABASE_URL`+keys (service key server-only, never `EXPO_PUBLIC_`/`VITE_`); no Nest app target.
**Path B note:** workspace gains `apps/api` (Nest) consuming the *same* Zod schemas via `nestjs-zod`; env carries `DATABASE_URL`/`REDIS_URL`/JWT (server-only); CI gains a Postgres(+Redis) service container. T0.1 leaves an `apps/` slot + Turbo glob ready so adding `apps/api` is config-only.

---

## T0.2 — `packages/shared`: Zod schemas + theme tokens + UI primitives

**Objective:** make `packages/shared` *law* — every §4 entity schema + the order status machine + B-Systems §9 theme tokens + the RTL-correct primitives kit, all defined once and consumed by mobile + web (+ server).

**Exit gate:** CI green for `packages/shared` (ESM+CJS+types for every subpath; typecheck/lint/vitest pass) **and**: (1) every §4 entity has a Zod schema + exported inferred type, validated by 1-valid/3-invalid fixtures incl. rejection of negative inventory & float money; (2) the status machine accepts 100% of legal `(from,to)` pairs and rejects every illegal/terminal-violating pair; (3) §9 tokens expose all scales with a status color enforced per `OrderStatus` and emit valid CSS vars with a `[dir=rtl]` block; (4) all six primitives render correctly in ltr **and** rtl, `Price` formats EGP from integer piastres in `ar-EG`, `StatusPill` is exhaustive over `OrderStatus`; (5) a downstream smoke consumer imports all four subpaths, typechecks, parses a fixture, and the no-duplicate-shapes guard reports zero violations.

| Task | Acceptance test | Auto | Est |
|---|---|---|---|
| **T0.2.1** Bootstrap package: tsup ESM+CJS+`.d.ts`, subpath exports (`./schemas` `./theme` `./ui` `./state`), single pinned zod, turbo wiring | fresh `pnpm install` → build + typecheck + a smoke consumer imports each subpath → ESM+CJS+types emitted per subpath, typecheck clean (no `any`), each subpath resolves with full types | ✅ | M |
| **T0.2.2** Zod schema per §4 entity, branded IDs, **money as integer piastres**, EG E.164 phone, Insert/Update/Row variants (client Insert omits server-set money/stock) | 1 valid + ≥3 invalid fixtures per entity (negative qty, float money, bad phone, malformed polygon, unknown role/status) → run schema suite + type-level test → all valid parse, all invalid rejected at expected path, `z.infer` equals published type | ✅ | L |
| **T0.2.3** Order status machine: legal transitions, terminal states, pure guarded `applyTransition`/`canTransition`/`nextStates`/`isTerminal` | full transition table + exhaustive `(from,to)` matrix → run suite incl. terminal cases → every legal edge passes, every illegal edge throws `InvalidTransitionError`, `isTerminal` true only for `cancelled`/`refunded`, `nextStates(delivered)===['refunded']`, 100% pair coverage | ✅ | M |
| **T0.2.4** §9 theme tokens (palette/type/spacing/radii/elevation/z), logical start/end for RTL, emitted as TS object + CSS vars + Tailwind preset stub | tokens + `OrderStatus` → assert all scales exist, `statusColors` has exactly one entry per status (`Record<OrderStatus,…>`), `cssVars()` parses as valid CSS with a `[dir=rtl]` block | ✅ | M |
| **T0.2.5** RTL-correct primitives: `Button`/`Card`/`Price`/`QtyStepper`/`StatusPill`/`Sheet` + ThemeProvider, with states + ltr/rtl stories | mount under test renderer ltr & rtl → `Price(150050 piastres)` renders ar-EG EGP w/ promo strike-through; `StatusPill` covers every status (exhaustiveness fails if unmapped); `Button` aria-busy when loading / non-interactive disabled; `QtyStepper` disables at bounds; `Sheet` traps focus & closes on ESC; logical icon/edge flips ltr↔rtl | ✅ | L |
| **T0.2.6** Cross-surface contract guard: JSON round-trip parity + no-duplicate-shapes lint guard + smoke consumer of all 4 subpaths | representative serialized `Order` graph + consumer source globs → `JSON.parse(JSON.stringify(order))` re-validated by `OrderSchema`; duplicate-shape guard scans consumers; smoke consumer imports 4 subpaths → round-trip deep-equal (money/timestamps/IDs lossless), zero duplicated shapes, smoke typechecks & parses | ✅ | M |

**Path A note:** add a check diffing Zod field names/nullability against `supabase gen types`; Edge Functions import the same schemas; `qty_available>=0` is also a DB `CHECK`; status machine is a guard, authoritative transition runs in a Postgres/Edge function.
**Path B note:** contract test asserts Zod ⇄ Prisma-generated types (no drift); Nest DTOs derive from the same Zod via `nestjs-zod`; status machine imported by the orders service, executed inside the Prisma transaction; money → Prisma `Int`.

---

## T0.3 — DB schema migration + RBAC/authz scaffold + `customer_catalog` view

**Objective:** stand up the §4 core relational schema as a versioned, reversible migration that is the single source of truth; make the stock invariant un-violable at the DB layer; expose the single `customer_catalog(branch_id)` read view; install branch-scoped RBAC proven by negative tests; write `audit_log` on every catalog/stock/price/visibility change; ship deterministic seed for the spikes.

**Exit gate:** on a clean Postgres, CI runs migration + seed then the integration suite green: (1) schema applies & rolls back cleanly; (2) `qty_available=-1` and duplicate `(product_id,branch_id)` writes are rejected by DB constraints; (3) `customer_catalog` returns ONLY rows that are active AND listed AND `qty_available>0` AND price-resolved, leaking no internal columns; (4) the negative authz suite proves customer-vs-customer, operator-vs-other-branch, and non-admin-vs-master-catalog isolation (each DENY paired with an authorized allow); (5) the seed is idempotent and yields the documented spike substrate. Demonstrable by a single `ci: db` job going green.

| Task | Acceptance test | Auto | Est |
|---|---|---|---|
| **T0.3.1** §4 core schema migration with money/stock invariants as DB constraints (`CHECK qty_available>=0`, `CHECK qty_reserved>=0`, `UNIQUE(product_id,branch_id)` ×2, money as minor units) + ADR on money/id strategy | clean DB → apply forward, then `UPDATE … qty_available=-1` and a duplicate `(product_id,branch_id)` insert, then rollback → migration applies clean, the `-1` update rejected by CHECK, duplicate rejected by UNIQUE, rollback drops everything cleanly | ✅ | L |
| **T0.3.2** `customer_catalog(branch_id)` derived read view (active AND listed AND `qty_available>0` AND price resolves; exposes only display fields) | seed: (1) inactive, (2) active+unlisted-in-branch, (3) active+listed+`qty=0`, (4) active+listed+in-stock+no price, (5) fully eligible → query `customer_catalog` for branch → only case 5 returned; cost/`qty_reserved`/internal columns absent | ✅ | M |
| **T0.3.3** RBAC scaffold: 4 roles, branch scoping, current-actor context derived from the **authenticated principal** (never client params), default-deny | authenticated principals per role → resolve actor context + a scoped read → context exposes correct role + branch_id (null for customer/HQ-admin, branch-A for operator/manager); branch queries auto-constrained; unauthenticated → authz error, not open access | ✅ | L |
| **T0.3.4** Negative authz suite (the real gate on T0.3.3) | seeded 2 customers / 2 branches / a master-catalog row → attempt each forbidden access (cross-customer order read; operator reads other branch; operator/manager writes master catalog/price/visibility; customer selects internal column) → every forbidden attempt DENIED (zero rows or authz error); each paired with an authorized control that succeeds | ✅ | M |
| **T0.3.5** Deterministic, idempotent seed: 2 branches + zones (distinct priorities) + products/inventory/prices (incl. `qty=1` SKU, out-of-stock, inactive, unlisted-in-B, no-price) + one principal per role | clean DB w/ migration → run seed twice → after run 1 the expected counts/edge-cases exist; run 2 leaves identical counts (no duplicates, no constraint violations) | ✅ | M |

**Path A note:** schema/view/constraints in `supabase/migrations`; RBAC via RLS keyed on `auth.uid()` + JWT claims (`role`,`branch_id`); `audit_log` via Postgres triggers; negative tests authenticate as role-specific JWTs. Risk: RLS policy sprawl — keep a single policy-matrix file and test every cell.
**Path B note:** schema in `prisma/schema.prisma`; CHECK constraints + the view via raw-SQL migration steps (not expressible in Prisma DSL); RBAC via a Prisma client extension/middleware injecting branch/owner scoping from the request `AuthzContext` (resolved in a Nest guard) + method guards; `audit_log` written **transactionally inside the same Prisma transaction** as each mutation; PostGIS columns via `Unsupported("geography")`.

---

## S1 — Spike: oversell-safe atomic stock decrement + reservation model  *(the headline gate)*

**Objective:** prove per-branch stock cannot be oversold under concurrency. Throwaway-OK but mechanism-correct vertical slice of the reservation model: a single transactional "place reservation" that atomically moves N from `qty_available` → `qty_reserved` per `(branch_id, sku)` with DB-enforced `qty_available>=0`, plus symmetric cancel (`reserved→available`) and fulfill (decrement `reserved`).

**Exit gate:** a CI-runnable test fires **20 (and 100, and 1000)** concurrent place-reservation calls against a SKU seeded `qty_available=1` and asserts: exactly **1 success**, the rest a typed `OUT_OF_STOCK` (not a 500/deadlock/timeout), final `qty_available=0`/`qty_reserved=1`, `CHECK(qty_available>=0)` never violated. Cancel returns the unit; fulfill leaves `available=0`/`reserved=0`. Green on a single run and **50× repeated** (flake check); ADR merged recommending the concurrency strategy + backend path with measured p95 under contention.

| Task | Acceptance test | Auto | Est |
|---|---|---|---|
| **S1-T1** Inventory schema + DB-enforced non-negative invariant (path-agnostic), `InventoryRow` Zod in shared | row `qty_available=0` → raw `UPDATE … qty_available=-1` (bypassing app) → DB raises CHECK violation, row stays 0; shared Zod validates persisted shape | ✅ | S |
| **S1-T2** Server-authoritative atomic place-reservation (conditional compare-and-decrement, rowcount===1; **no read-then-write**; typed `OUT_OF_STOCK`, not 500) | `qty_available=1` → `place(B,S,1)` then `place(B,S,1)` again → first success (`available=0`/`reserved=1`), second typed `OUT_OF_STOCK` (no exception, no negative); responses validate against shared schemas | ✅ | M |
| **S1-T3** Cancel (`reserved→available`) + fulfill (decrement `reserved`), transactional & retry-safe | `available=1`,`reserved=0` → `place(1)`+`cancel(1)` on one fixture, `place(1)`+`fulfill(1)` on another → cancel ends `available=1`/`reserved=0`; fulfill ends `available=0`/`reserved=0`; never negative | ✅ | M |
| **S1-T4** THE canonical concurrency proof: 20/100/1000 concurrent calls via `Promise.all` against the **real** served path (not in-process mocks) + 50× flake loop + p95 capture | freshly seeded `qty_available=1` → 20/100/1000 concurrent `place(B,S,1)` → exactly 1 success, rest typed `OUT_OF_STOCK`, no 5xx/deadlock, final `available=0`/`reserved=1`; passes single run and 50× repeats | ✅ | L |
| **S1-T5** ADR: concurrency strategy + backend-path recommendation, backed by T4 numbers (DB is authority; Redis, if any, is optimization not correctness) | T4 results + latency → reviewer reads merged ADR → it states chosen locking strategy + recommended path with measured correctness + p95 evidence and rationale tied to spike data | ☐ doc | S |

**Path A note:** inventory table w/ `CHECK` + `UNIQUE(branch_id,sku_id)`; place/cancel/fulfill as PL/pgSQL functions via RPC from a Deno Edge Function; safety from a single conditional `UPDATE … WHERE qty_available>=n RETURNING` (or `SELECT … FOR UPDATE` in a `SECURITY DEFINER` fn). RLS is **not** the enforcement layer for arithmetic.
**Path B note:** same table/constraint via Prisma + raw SQL for CHECK; place/cancel/fulfill in an `InventoryService` inside a `$transaction`. A/B two strategies in the spike: (1) pure-DB atomic conditional `UPDATE` checking affected-rowcount===1 — **recommended primary**; (2) Redis lock only to compare latency/fairness, documented as non-authoritative. Test via supertest firing `Promise.all` against the Nest app + Postgres/Redis testcontainers.

---

## S2 — Spike: address point → branch zone resolution  *(do first; ADR's likeliest slip)*

**Objective:** prove geo routing — given a lat/lng, resolve which branch `delivery_zone` polygon contains it; tie-break overlapping zones by **priority then distance**; reject points outside all zones.

**Exit gate (maps to §11 routing test):** for the seeded fixture (isolated zone, differing-priority overlap, equal-priority overlap at differing distances, uncovered gap): an in-zone point → its branch; a differing-priority overlap → the higher-priority branch; an equal-priority overlap → the nearer branch; an outside point → `not_deliverable`; malformed input → 400. Deterministic across runs; GiST index confirmed via `EXPLAIN`.

| Task | Acceptance test | Auto | Est |
|---|---|---|---|
| **S2-T1** Spatial schema + GiST indexes + deterministic seed fixtures (isolated / differing-priority overlap / equal-priority overlap / gap) with stable IDs | clean Postgres w/ spatial extension → apply spike migration + seed → `branches`/`delivery_zones` have geography columns + GiST indexes; seed returns exactly the documented fixture set with stable known IDs | ✅ | M |
| **S2-T2** Shared `ResolveZoneRequest`/`ResolveZoneResponse` Zod (discriminated union on `status`: `in_zone` vs `not_deliverable`), coordinate range validation | exported schemas → parse valid/invalid payloads + round-trip a uuid → valid `{lat,lng}` parses; `lat>90`/`lng>180`/non-numeric rejected with issues; response union narrows on `status` | ✅ | S |
| **S2-T3** Resolver query: containment (`ST_Contains`/`ST_Covers` on geography) + `ORDER BY priority DESC, distance ASC` + stable final tiebreaker; reject if none; `EXPLAIN` confirms GiST | seeded fixture → run resolver for in-zone / differing-priority overlap / equal-priority overlap / gap → owning branch / higher-priority branch / nearer branch / no row; deterministic; index used | ✅ | L |
| **S2-T4** Thin server resolver endpoint (`POST /resolve-zone`) wired to the shared contract (validate → resolve → serialize union); 400 on bad input; outside → structured `not_deliverable` (no 5xx) | running endpoint + seeded fixture → POST in-zone / overlap / outside / malformed → 200 `in_zone` w/ expected branch; 200 `in_zone` tie-broken branch; 200 `not_deliverable`; 400 with validation issues; all bodies conform to the shared response schema | ✅ | M |
| **S2-T5** ADR: geo stack decision + spike findings + production follow-ups (auth/RBAC on the endpoint, `audit_log` on zone writes, MultiPolygon, boundary handling, cache invalidation) + one-command repro | completed T1–T4 + green suite → reviewer follows ADR repro steps → ADR states chosen geo stack + rationale, references the passing cases + tie-break order + index finding, lists production follow-ups; the documented command reproduces a green run | ☐ doc | S |

**Path A note:** enable PostGIS in a Supabase migration; resolver as a SQL function via an Edge Function `POST /resolve-zone` validating with the shared Zod; spike runs against `supabase start`. (`earthdistance`/`cube` only do radius, not polygon containment — PostGIS is the realistic choice.)
**Path B note:** PostGIS on the Postgres instance (docker-compose for the spike); geography columns via raw SQL migration (Prisma geo support is limited) + manual GiST indexes; resolver in a Nest `GeoService` via `prisma.$queryRaw` (parameterized) behind `POST /geo/resolve-zone` with a Zod validation pipe; integration tests against dockerized PostGIS + supertest e2e. Production may cache point→branch in Redis keyed by rounded coords, invalidated on zone edits.

---

## S3 — Spike: realtime order-status push + reconnect refetch

**Objective:** prove the narrowest realtime slice — a server-authoritative order-status change pushes to exactly one subscribed customer device on a channel-per-order within the realtime SLA (target p95 ≤ 2s) with no manual refresh; a subscriber receives **only its own** order's events (negative authz); killing+reconnecting the socket deterministically triggers an authoritative TanStack Query REST refetch that converges to true server state (incl. a status missed while offline). Decide A vs B for order-status push (ADR). Does **not** build the full order UI, courier stream, firehose, or low-stock alerts.

**Exit gate:** one command (`pnpm spike:s3`) that (1) spins up the chosen backend + a headless subscriber, advances an order, asserts the event arrives on the order's channel with measured **p95 ≤ 2s over ≥50 transitions**; (2) a negative-authz test proving a subscriber on order-A's channel receives **zero** of order-B's events and that subscribing to another customer's order is rejected at the data/transport layer; (3) a reconnect test that drops the socket, advances status offline, reconnects, asserts a **single** authoritative REST refetch fires and observed state equals server state (no lost transition). All green in CI; `PERF.md` records p50/p95/p99; `ADR-realtime.md` records the A-vs-B decision and the throwaway-vs-keep call.

| Task | Acceptance test | Auto | Est |
|---|---|---|---|
| **S3-T1** Shared contract: `OrderStatusEvent` (with monotonic `version`), `OrderReadDTO` for the refetch, `orderChannelName`/`parseOrderChannel` helpers | exported schemas + helpers → parse valid/malformed event + round-trip a uuid → valid passes, malformed (bad status/missing version) fails typed; `parseOrderChannel(orderChannelName(id))===id`; no `any` | ✅ | S |
| **S3-T2** Server-authoritative status transition + **post-commit** channel-per-order publish; authoritative `GET /orders/:id` for the refetch | seeded order `placed`/`version=0` → advance-status to `confirmed` → DB `confirmed`/`version=1`, exactly one event published to `order:{id}` matching the committed row, `GET /orders/:id` returns same status+version | ✅ | M |
| **S3-T3** Headless subscriber + TanStack Query cache wiring: apply push via `setQueryData` **only if `event.version > cached`** (drop stale), **no refetch on normal push**; `waitForStatus` helper for latency | subscriber on `order:{id}` cached `version=1` → server publishes `version=2`, then a replayed `version=1` → cache reflects `confirmed`@v2 with **zero** REST refetch; replayed v1 ignored | ✅ | M |
| **S3-T4** Negative authz: subscriber receives ONLY its own order's events; cross-order subscribe denied at data/transport layer; `GET /orders/:id` for a non-owned order → 403/404 | customer-A owns order-A, customer-B owns order-B, both transitioning → A subscribes to order:A, attempts order:B, calls `GET /orders/B` → A gets only order-A events; order:B subscription denied server-side (not client-filtered); `GET /orders/B` → 403/404 no leak | ✅ | M |
| **S3-T5** Reconnect: kill socket, transition offline, reconnect → **exactly one** authoritative `GET /orders/:id`, converge by version, no lost transition | subscriber at `confirmed(v1)`, socket killed → order advances to `preparing(v2)` offline, then reconnect → exactly one `GET /orders/:id` fires, cache converges to `preparing(v2)`, missed transition not lost (no manual refresh) | ✅ | M |
| **S3-T6** SLA latency harness (`pnpm spike:s3`, ≥50 transitions, `PERF.md` p50/p95/p99, fail if p95>2s) + `ADR-realtime.md` (A vs B; throwaway/keep) wiring all suites into one command | clean checkout, backend bootable locally → `pnpm spike:s3` → ≥50 transitions, `PERF.md` written, asserts p95≤2s (fails otherwise), contract/push/authz/reconnect suites all pass | ✅ | M |

**Path A note:** orders in Postgres w/ RLS; Realtime via Postgres Changes (filtered by id) or Broadcast emitted from the Edge Function doing the transactional change; channel-per-order = a Realtime channel `order:{id}`; channel authz via RLS / Realtime authorization (no client filtering); publish post-commit; refetch = RLS-scoped PostgREST GET. Lowest plumbing.
**Path B note:** orders via Prisma; status advance + version bump in a `$transaction`, **post-commit** publish; transport = Socket.IO gateway (or managed Ably/Pusher) with rooms `order:{id}`; a WS guard validates the session + checks ownership at room-join; Redis pub/sub fans events across instances; `GET /orders/:id` guarded by the same ownership policy (403/404). More plumbing, full control, mature Jest/Supertest story.

---

### Definition of Done (applies to every task — Plan §11)
1. Meets its acceptance criteria with an automated test (or a documented manual test where automation is impractical).
2. Typechecks (no `any` escapes), lints, formatted.
3. Self-review checklist + acceptance test green.
4. No secrets committed; env documented.
5. Handles loading / empty / error / offline states (any UI).
6. RTL + Arabic correct; works on the smallest target device.
7. Docs/changelog updated; ADR added if an architectural decision was made.
