# Hypermarket E-Commerce & Delivery Platform — Engineering Plan & Claude Code Build Prompt

**Owner:** B-Systems
**Doc type:** Technical implementation plan + executable Claude Code prompt
**Source:** "تطبيق التسوق والتوصيل للهايبر ماركت" proposal — restructured to 2 surfaces: Customer mobile app + one Web Dashboard (operations + central command)
**Audience:** Senior engineers, PM, and Claude Code (as the implementing agent)

---

## 0. How to use this document

This file is two things at once:

1. **An engineering plan** a senior team would actually work from — architecture, data model, real-time strategy, milestones, definition-of-done, and acceptance gates.
2. **A Claude Code prompt.** Section 14 is the literal prompt you paste into Claude Code. Everything before it is the shared context the prompt refers to. Keep this whole file in the repo as `/docs/ENGINEERING_PLAN.md` and have Claude Code read it at the start of every session.

> **Golden rule for the agent:** never mark a task "done" without satisfying its Definition of Done (DoD) *and* its acceptance test. "It compiles" is not done. "It renders" is not done. Done = the acceptance check in Section 11 passes and is demonstrable.

---

## 1. Product decomposition — what we're actually building

**Two surfaces only.** The consumer-facing app is React Native (mobile). **Everything operational and administrative is ONE web-based dashboard** — there is no operations mobile/tablet app. Store staff, branch managers, and HQ all work inside the same web dashboard, separated by role, not by separate apps.

### 1.1 Customer App (React Native — iOS + Android) — the ONLY mobile app
The revenue surface. Shopper-facing.
- Auth (phone/OTP), address book with geolocation
- Browse: categories, search, filters, product detail
- Cart + live price/stock validation
- Checkout: slot selection, address, payment (online or COD)
- Order tracking (live status + courier location)
- Order history + one-tap reorder
- Offers/coupons, loyalty points (Phase 2)

### 1.2 Central Web Dashboard (React + Vite — web only) — operations AND command in one
This is the heart of the system and the thing the client explicitly requires: a single web-based control center that **receives every order from every store, owns the entire product catalog, and controls exactly what each customer sees and the stock/quantity behind it.** It is role-gated into views, but it is one application, one deployment, one source of truth.

**Roles inside the dashboard (same app, RBAC-scoped views):**
- **HQ / Admin / Owner** — full central command (all branches, full catalog, all orders, pricing, reports, staff).
- **Branch Operator** — scoped to their branch: their incoming orders, their stock, their fulfillment.
- **Branch Manager** — branch ops + branch-level reporting and limited catalog/stock control for that branch.

**A. Central Command (HQ view) — the explicit requirement**
- **All-orders firehose:** every order from every branch lands here in real time — filterable by branch, status, date, payment method, customer. HQ can watch, search, escalate, reassign, cancel, or refund any order across the whole network from one screen.
- **Master catalog control:** the single place that defines every product (name, images, category, description, unit, base price). Nothing exists in the customer app that wasn't created here.
- **Visibility control — "what each customer sees":** per-product and per-branch publish/unpublish toggles. A product is shown to a customer **only if** it is `is_active` (master) AND active for the branch serving that customer's address AND `qty_available > 0` for that branch. HQ can hide a product network-wide instantly, or hide it for one branch, and the customer app reflects it live.
- **Stock & quantity control:** HQ sees and can set `qty_available` for every product at every branch, set low-stock thresholds, receive low-stock/out-of-stock alerts, and do bulk stock adjustments. This is the authoritative stock ledger; the customer app's availability is a read of this.
- **Pricing & promotions:** base prices, per-branch overrides, promo windows — all defined here, all server-enforced at checkout.
- **Network dashboards & reports:** sales by branch/category/time, top products, fulfillment SLAs, order funnel, stock health.
- **Branch & zone management:** create branches, draw geofenced delivery zones on a map, set prep times, activate/deactivate branches.
- **Staff & roles:** create dashboard users, assign role + branch scope.

**B. Branch Operations (operator view) — fulfillment, in the same web dashboard**
- **Incoming order queue (real-time)** for that branch — new orders appear instantly.
- **Pick / pack / confirm** flow per order, driving the order status machine.
- **Live stock management** — adjust stock as items are picked/sold/restocked; any change instantly reflects in the customer app and rolls up to Central Command.
- **Courier assignment + handoff**, returns/refunds initiation.

> **Single source of truth:** the dashboard's catalog + inventory + pricing tables are authoritative. The customer app never defines a product, a price, or a stock number — it only *reads* what the dashboard publishes and *writes* orders back into it. This guarantees the client's requirement that the dashboard "controls all the products it displays to all customers and the quantity and stock of it."

### 1.4 The three "hard" problems (where the engineering risk lives)
The proposal's selling points map directly to the three hardest technical problems. **These get prototyped first (de-risk early), not last.**

| Proposal promise | Real engineering problem | Why it's hard |
|---|---|---|
| "المخزون لحظي — مفيش طلب على حاجة ناقصة" | Real-time, per-branch stock accuracy with race-condition-safe decrements | Concurrent carts can oversell; stock must reconcile across Ops actions, customer orders, and admin edits |
| "كل فرع يخدم منطقته الجغرافية" | Geo-routing an order to the correct branch by delivery address | Requires geofenced zones, address→zone resolution, branch selection + fallback |
| "تتبع لحظي للطلب" | Live order status + courier location streaming | Real-time transport, battery/network resilience, map rendering |

---

## 2. Recommended stack (with rationale + alternatives)

The consumer client is React Native; the entire operations + command layer is one React web dashboard. We pick a backend that minimizes real-time plumbing so the team ships the differentiators (live stock, branch routing, live tracking, central command) instead of reinventing infrastructure.

### 2.1 Mobile — Customer App ONLY (React Native)
- **Expo (React Native) + TypeScript** — managed workflow, EAS Build/Submit for store delivery (the proposal explicitly promises Android & iOS on Play + App Store). Drop to bare workflow only if a native module forces it.
- **Expo Router** — file-based navigation, deep links (needed for `hyper.app/...` style links and push-notification routing).
- **State/data:** **TanStack Query** (server cache, the real source of truth) + **Zustand** (local UI/ephemeral state like the cart before checkout). Do **not** reach for Redux unless a concrete need appears.
- **Forms/validation:** React Hook Form + **Zod** (Zod schemas are shared with the backend — one source of truth for shapes).
- **Maps:** `react-native-maps` (Google Maps provider) for tracking + address pin.
- **Push:** Expo Notifications → FCM/APNs.
- **UI:** a small in-house component kit styled to B-Systems tokens (see §9). No heavy UI framework.

### 2.2 Web Dashboard — Operations + Central Command (ONE app, role-gated)
- **React + Vite + TypeScript** — single SPA, RBAC routing (HQ/admin vs branch-operator vs branch-manager views in the same build).
- **TanStack Query** for server cache + **TanStack Table** for the big order/catalog/inventory grids.
- **Realtime client** (Supabase Realtime or Socket.IO per backend path) for the live all-orders firehose, the per-branch order queue, and live stock changes.
- **Tailwind** tokenized to the B-Systems palette; **Recharts** for dashboards; a map lib (react-leaflet / Google Maps JS) for drawing geofenced delivery zones.
- **Forms/validation:** React Hook Form + the same shared **Zod** schemas as the mobile app.
- Must be responsive enough to use on a store tablet in a browser (operators work on tablets), but it is a **web app, not a native app**.

### 2.3 Backend
Two viable paths — pick based on team familiarity. **Default recommendation: Path A.**

**Path A — Supabase (Postgres + Realtime + Auth + Storage + Edge Functions).** *Recommended for speed.*
- Postgres with Row Level Security (RLS) for multi-role access.
- **Realtime** (Postgres logical replication → websockets) gives live stock + order updates almost for free — directly serving two of the three hard problems.
- Auth (phone OTP), Storage (product images), Edge Functions (Deno) for server-authoritative logic (checkout, stock decrement, payment webhooks).
- Trade-off: opinionated; complex transactional logic lives in SQL functions/Edge Functions.

**Path B — NestJS (Node + TypeScript) + Postgres (Prisma) + Redis + a managed realtime layer.** *Recommended if the team wants full control / expects heavy custom business logic.*
- NestJS modular monolith, Prisma ORM, Redis for locks + pub/sub, Postgres for data.
- Realtime via WebSocket gateway (Socket.IO) or a managed service (Ably/Pusher).
- PostGIS extension for geo queries.
- Trade-off: more infra to own; slower to first demo.

**Backend decision is logged as ADR-0001 (see §13). Whichever path: business-critical operations (stock decrement, order placement, payment) MUST be server-authoritative and transactional. Never trust the client for stock or price.**

> **Project note (2026-06-18):** ADR-0001 was produced by a 4-lens judge panel and **recommends Path B (NestJS)** — counter to the §2.3 default-for-speed — at 0.76 confidence. See [adr/0001-backend-choice.md](adr/0001-backend-choice.md). Pending user confirmation before scaffolding.

### 2.4 Payments
- **Online:** Paymob (Egypt-first: cards, wallets, Fawry) — abstracted behind a `PaymentProvider` interface so it can be swapped.
- **COD:** first-class path; most hypermarket orders in market are cash-on-delivery. COD is the default, not an afterthought.

### 2.5 Geo / routing
- **PostGIS** (Path B) or Postgres `earthdistance`/`cube` or a `geozones` polygon table queried in an Edge Function (Path A).
- Delivery zones = polygons per branch. Address → point → "which branch's zone contains this point" → assign; tie-break by distance; fallback to "nearest active branch with stock."

### 2.6 Infra / DevOps
- Monorepo (Turborepo or pnpm workspaces): `apps/customer` (React Native), `apps/dashboard` (React web — operations + command), `packages/shared` (Zod schemas, types, API client, constants). No `apps/ops` — operations lives inside `apps/dashboard`.
- CI: GitHub Actions — typecheck, lint, test, build on every PR.
- Mobile delivery: EAS Build + EAS Submit; OTA updates via EAS Update for JS-only changes.
- Error tracking: Sentry (both surfaces — customer app + dashboard). Analytics: PostHog or Firebase.
- Environments: `dev`, `staging`, `prod` with separate backend projects/keys.

---

## 3. System architecture (text diagram)

```
                         ┌─────────────────────────────────────────────┐
                         │              BACKEND (server-auth)            │
                         │   Postgres (+PostGIS)  ·  Realtime / WS        │
                         │   Auth(OTP) · Storage · Edge/Service fns       │
                         │   Payment webhooks · Push dispatch             │
                         │   >>> authoritative catalog · stock · pricing  │
                         └───────────────▲─────────────────▲─────────────┘
                                         │                 │
                       realtime + REST   │                 │  realtime + REST
            ┌────────────────────────────┘                 └──────────────────────────────┐
            │                                                                              │
   ┌────────┴──────────┐                                   ┌───────────────────────────────┴───────────┐
   │   CUSTOMER APP      │                                   │      CENTRAL WEB DASHBOARD (React/Vite)     │
   │   (Expo RN, mobile) │                                   │      one app · role-gated views             │
   │   browse / cart /   │   reads published catalog+stock   │  ┌─────────────────┐  ┌──────────────────┐ │
   │   checkout / track  │ ◀───────────────────────────────  │  │ CENTRAL COMMAND │  │ BRANCH OPERATIONS│ │
   │                     │   writes orders ───────────────▶  │  │ (HQ/admin):     │  │ (operator):      │ │
   │  READ-ONLY on       │                                   │  │ all orders feed │  │ branch order     │ │
   │  catalog/price/stock│                                   │  │ master catalog  │  │ queue, pick/pack,│ │
   │  (never defines them)│                                  │  │ visibility ctrl │  │ live stock,      │ │
   └─────────────────────┘                                   │  │ stock & pricing │  │ courier handoff  │ │
            │                                                │  │ reports, zones  │  │                  │ │
            │                                                │  └─────────────────┘  └──────────────────┘ │
            │                                                └─────────────────────────────────────────────┘
            │  shared types, Zod schemas, API client live in packages/shared (consumed by both)            │
            └─────────────────────────────────────────────────────────────────────────────────────────────┘
```

The **dashboard owns the catalog, stock, and pricing**; the **customer app only reads what the dashboard publishes and writes orders back**. Every order flows from the customer app into the dashboard's Central Command feed in real time.

Key flows:
- **Stock decrement** is server-authoritative and transactional. Customer "place order" → server checks-and-decrements stock in one transaction (row lock / `SELECT ... FOR UPDATE` or atomic `UPDATE ... WHERE qty >= n RETURNING`). On success, order is created; on failure, customer sees "item just went out of stock."
- **Live stock** propagates: any stock change writes to `inventory` table → Realtime publishes → Customer App invalidates/updates the product's availability.
- **Order routing:** at checkout, address point → zone lookup → branch assignment before payment.

---

## 4. Data model (core tables — the contract)

Shared Zod schemas in `packages/shared/schemas` mirror these. This is the single source of truth.

```
branches        (id, name, location:geography(point), is_active, prep_time_min, created_at)
delivery_zones  (id, branch_id→branches, polygon:geography(polygon), priority)
categories      (id, name_ar, name_en, parent_id?, sort, image_url)
products        (id, sku, name_ar, name_en, description, category_id→categories,
                 base_price, image_urls[], unit, is_active)   -- is_active = master kill-switch (HQ)
branch_products (id, product_id→products, branch_id→branches, is_listed,
                 low_stock_threshold)                          -- UNIQUE(product_id, branch_id)
                                                               -- per-branch visibility toggle (HQ/manager)
inventory       (id, product_id→products, branch_id→branches, qty_available,
                 qty_reserved, updated_at)              -- UNIQUE(product_id, branch_id)
prices          (id, product_id, branch_id?, price, starts_at, ends_at)  -- branch overrides + promo windows
promotions      (id, code, type[pct|fixed|bogo], value, min_subtotal, starts_at, ends_at, active)
customers       (id, phone, name, created_at)
addresses       (id, customer_id, label, location:geography(point), text, is_default)
carts           (id, customer_id, branch_id?, status[active|converted|abandoned])
cart_items      (id, cart_id, product_id, qty, unit_price_snapshot)
orders          (id, customer_id, branch_id, address_id, status, subtotal, delivery_fee,
                 discount, total, payment_method[online|cod], payment_status,
                 slot_start, slot_end, placed_at)
order_items     (id, order_id, product_id, qty, unit_price, line_total)
order_events    (id, order_id, status, actor, note, created_at)   -- the audit/track timeline
couriers        (id, branch_id, name, phone, is_available, last_location:geography(point))
deliveries      (id, order_id, courier_id?, status, assigned_at, picked_at, delivered_at)
staff_users     (id, branch_id?, role[admin|manager|operator|courier], phone, name)
                                                       -- the dashboard's RBAC actors
audit_log       (id, actor_id, action, entity, entity_id, before, after, created_at)
                                                       -- who changed catalog/stock/price/visibility
```

**Customer-visible product = a derived view, not a free choice of the app.** A product appears in the customer app for a given delivery branch **only if** ALL are true:
`products.is_active = true` AND `branch_products.is_listed = true` (for that branch) AND `inventory.qty_available > 0` (for that branch) AND any active `prices` row resolves. Expose this as a single read API / SQL view (`customer_catalog(branch_id)`) so the app cannot accidentally show something HQ hasn't published. This is the technical enforcement of the client's requirement that the dashboard controls exactly what every customer sees.

**Order status machine (single source of truth, enforced server-side):**
`placed → confirmed → picking → packed → out_for_delivery → delivered`
with side-branches `cancelled` (pre-pick) and `refunded` (post-delivery). Illegal transitions are rejected by the server, never just hidden in the UI.

**Stock invariants:**
- `qty_available >= 0` always (DB check constraint).
- Reservation model: on order placement, move `n` from `qty_available` to `qty_reserved` atomically. On fulfillment, decrement `qty_reserved`. On cancel, return reserved → available. This prevents overselling between "added to cart" and "delivered."

---

## 5. Real-time strategy (the make-or-break)

- **Customer App** subscribes to: their active order(s) status + courier location; product availability for items currently on screen.
- **Dashboard — branch-operator view** subscribes to: new orders for *its* branch; stock changes for its branch. **Dashboard — HQ/Central Command** subscribes to the all-branch orders firehose + network-wide low-stock alerts.
- **Admin** subscribes to: order firehose (filtered) + low-stock alerts.
- Use channel-per-branch and channel-per-order to keep payloads small.
- **Resilience:** all real-time is an *optimization over* REST, never the only path. On reconnect, refetch authoritative state (TanStack Query refetch). Courier location updates throttled (e.g. every 10–15s, or on 50m movement) to protect battery.

---

## 6. Security & correctness (non-negotiable)

- **Server-authoritative everything money/stock-related.** Client computes a *display* price; server recomputes the *charged* price at checkout from current `prices`/`promotions`. Mismatch → reject and re-quote.
- **Row Level Security / authz by role:** customers see only their own data; ops users see only their branch; admins see all. Test this with negative tests (a customer token must NOT read another customer's order).
- **Idempotency:** checkout + payment webhooks use idempotency keys (double-tap "place order" must not create two orders or double-charge).
- **Input validation** with shared Zod schemas on both client and server boundary.
- **Secrets** never in the repo; use env + EAS secrets. PII (phone, address) access-logged.
- **Payment** integrity verified via signed webhooks; never mark `payment_status=paid` from the client.

---

## 7. Non-functional requirements (acceptance-testable)

- **Performance:** product list scroll ≥ 55fps on a mid-range Android; product detail TTI < 1.5s on 4G; cart→order placement round-trip < 2.5s p95.
- **Offline/poor-network:** Customer App shows cached catalog read-only when offline; checkout blocked gracefully with a clear message; no crash.
- **Accessibility:** RTL-correct Arabic layout throughout; min tap target 44×44; dynamic font scaling; screen-reader labels on actions.
- **Localization:** Arabic-first (Egyptian), RTL by default; strings externalized (i18n) so English can be added.
- **Reliability:** no oversell under concurrent-order load test (see §11); zero illegal status transitions in fuzz test.

---

## 8. Testing strategy (what "tested" means)

- **Unit:** business logic (pricing, promo application, zone resolution, status machine) — pure functions, high coverage. Vitest/Jest.
- **Integration:** API/Edge functions against a test DB — stock decrement under concurrency, checkout idempotency, authz/RLS negative tests.
- **Component:** React Native Testing Library for critical screens (cart, checkout, order track).
- **E2E:** Detox (mobile) or Maestro (lighter, recommended) for the golden path: browse → add → checkout (COD) → track → delivered. One E2E for the ops pick/pack path.
- **Load:** a concurrency test that fires N simultaneous orders for the last unit of a SKU and asserts exactly one succeeds.
- **Manual QA checklist** per release (device matrix: 1 low-end Android, 1 modern Android, 1 iPhone).

CI must run unit + integration + component on every PR and block merge on failure.

---

## 9. Design system (reuse B-Systems tokens — already defined)

The apps inherit the B-Systems brand the proposal was built in. Tokens:
- Systems Indigo `#1D267D` (anchor, 60%), Process Lavender `#D4ADFC`, Signal Pink `#FF4F87` (accent/CTA only, ~12%), Paper `#FAFAFD`, Lavender Mist `#E8D4FE`, Indigo Deep `#0B0F3D`.
- Signature gradient `135deg, #0B0F3D → #1D267D → #4A2A8E → #8B3A95 → #FF4F87` for hero/marketing moments only — not as app chrome.
- Type: Raleway (display), Inter (UI/body Latin), Cairo (Arabic), JetBrains Mono (labels/meta/numerics).
- 60/28/12 color distribution; pink punctuates, never fills surfaces.
Package these as `packages/shared/theme` (tokens) + a primitives kit (`Button`, `Card`, `Price`, `QtyStepper`, `StatusPill`, `Sheet`). RTL-correct by construction.

---

## 10. Milestone plan (phased, each phase shippable & demoable)

Estimates assume a small senior team; adjust to capacity. Each phase ends with a **demo + acceptance gate**.

### Phase 0 — Foundation & de-risk (the three hard problems first)
- Monorepo, CI, env config, shared package skeleton, theme/primitives.
- Backend project + schema migration for core tables + RLS/authz scaffolding.
- **Spikes (throwaway-OK, but prove the mechanism):**
  - S1: concurrent stock decrement — prove no oversell.
  - S2: address point → branch zone resolution — prove correct routing.
  - S3: realtime order-status push to a device — prove live update + reconnect refetch.
- **Gate:** all three spikes demonstrably work; backend decision logged (ADR-0001).

### Phase 1 — Customer golden path (COD)
- Auth (OTP), address add w/ map pin + zone resolution.
- Catalog browse/search/filter, product detail, cart.
- Checkout (slot + address + COD), server-authoritative order placement w/ stock reservation.
- Order tracking screen (status timeline + live courier dot), order history, reorder.
- **Gate:** E2E golden path passes on real devices; oversell load test passes; price always server-recomputed.

### Phase 2 — Web Dashboard: Central Command (catalog, stock, visibility, all-orders feed)
This is where the client's explicit requirement lands. Build the HQ command layer first because the customer app depends on it being the source of truth.
- Dashboard app scaffold (React/Vite) + auth + RBAC routing (HQ/admin vs branch scopes).
- **Master catalog management:** create/edit products, categories, images, base price.
- **Visibility control:** per-product master `is_active` kill-switch + per-branch `branch_products.is_listed` toggle; changes reflect in the customer app live.
- **Stock & quantity control:** view/set `qty_available` per product per branch, low-stock thresholds, low/out-of-stock alerts, bulk adjustments.
- **Pricing & promotions:** base + per-branch overrides + promo windows (server-enforced at checkout).
- **All-orders firehose:** real-time feed of every order from every branch, filterable; HQ can search/cancel/refund/reassign across the network.
- **Branch & zone management:** branch CRUD + polygon zone editor on a map; staff/roles.
- `audit_log` writing on every catalog/stock/price/visibility change.
- **Gate:** HQ creates a branch+zone, adds a product with stock and lists it for that branch → it becomes visible & orderable in the Customer App for an in-zone address, **with no DB hand-editing**; HQ unpublishes it → it disappears from the app live; a customer order appears in the all-orders feed in real time.

### Phase 3 — Web Dashboard: Branch Operations (fulfillment)
Same app, operator-scoped views.
- Branch operator login, incoming **order queue** (realtime, branch-scoped), pick/pack/confirm driving the status machine, live stock adjust, courier assign/handoff, returns/refund initiation.
- Network dashboards & reports (sales by branch/category/time, top products, fulfillment SLA, stock health).
- **Gate:** an order placed in the Customer App appears in the branch operator's queue within the realtime SLA, can be driven through the full status machine, the customer sees each transition live, and every stock change made by the operator reflects in the customer app and rolls up to Central Command.

### Phase 4 — Online payments + hardening
- Paymob integration behind `PaymentProvider`, signed webhooks, idempotent checkout, refunds.
- Push notifications (order updates), Sentry, analytics, perf pass, a11y pass, store assets.
- **Gate:** paid order completes via webhook (not client), refund works, perf + a11y NFRs met, EAS builds submit to stores.

### Phase 5 — Phase-2 proposal features (post-launch)
- Loyalty/points, in-app support chat, web storefront, smart recommendations/offers.

---

## 11. Definition of Done & acceptance gates (per layer)

**A task/PR is Done only when ALL apply:**
1. Meets its acceptance criteria (below) and has an automated test proving it (or a documented manual test if automation is impractical).
2. Typechecks (no `any` escapes), lints, formatted.
3. Code reviewed (or, for the agent: self-review checklist + the acceptance test green).
4. No secrets committed; env documented.
5. Handles loading / empty / error states (no screen ships with only the happy path).
6. RTL + Arabic correct; works on smallest target device.
7. Docs/changelog updated; ADR added if an architectural decision was made.

**Phase acceptance tests (must be demonstrable, not asserted):**
- **Oversell test:** 20 concurrent "place order" calls for a SKU with stock=1 → exactly 1 success, 19 clean "out of stock"; `qty_available` never negative.
- **Routing test:** an address inside Branch A's zone always assigns to Branch A; an address in overlap assigns by priority then distance; an address outside all zones is rejected with "we don't deliver here yet."
- **Live-update test:** ops moves an order to `out_for_delivery` → customer device reflects it within the realtime SLA without manual refresh; kill the socket → app refetches correct state on reconnect.
- **Authz negative test:** customer token cannot read another customer's order; ops token cannot read another branch's orders; only admin can edit prices.
- **Price-integrity test:** tamper the client cart price → server rejects/recomputes; charged total always equals server calculation.
- **Idempotency test:** double-submit checkout → one order, one charge.
- **Golden-path E2E:** browse → add → COD checkout → ops pick/pack → out for delivery → delivered, all status visible to customer live.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Overselling under concurrency | Atomic check-and-decrement + reservation model; load test in Phase 0 |
| Realtime flakiness on poor networks | Realtime as optimization only; always-correct REST refetch on reconnect |
| Branch routing wrong at zone edges | Deterministic priority+distance tie-break; reject unknown zones; admin-editable polygons |
| Payment edge cases / double charge | Idempotency keys; server-only payment_status via signed webhook |
| Scope creep from Phase-2 features | Phases gated; loyalty/chat/web explicitly deferred |
| Store rejection (Apple/Google) | Follow store guidelines early; COD + privacy policy + account deletion built in Phase 1/4 |
| Stock drift vs physical reality | The dashboard's branch-operations view is the reconciliation point; periodic stock-count flow; admin override |

---

## 13. Engineering hygiene the agent must maintain

- **ADRs:** every architectural choice → short `docs/adr/NNNN-title.md` (context, decision, consequences). ADR-0001 = backend path.
- **Conventional Commits**; small PRs; one concern per PR.
- **`packages/shared` is law:** types/schemas defined once, imported everywhere. No duplicated shape definitions.
- **No TODO-and-move-on on money/stock/authz paths.** Those are finished or the task isn't done.
- **Every feature ships with its states** (loading/empty/error/offline).
- Keep a running `docs/STATUS.md`: what's done, what's in progress, what's blocked, with the acceptance evidence (test name or screenshot) for each completed item.

---

## 14. ⬇️ THE CLAUDE CODE PROMPT (paste this into Claude Code)

> Paste everything in this section. It references the sections above, which live in `/docs/ENGINEERING_PLAN.md`.

---

**ROLE.** You are the senior full-stack engineer + tech lead building a hypermarket e-commerce & delivery platform for B-Systems. You work in disciplined, test-gated increments. You do not claim completion without demonstrable proof.

**CONTEXT.** Read `/docs/ENGINEERING_PLAN.md` (this file) in full before doing anything, every session. It defines the product (§1), stack (§2), architecture (§3), data model (§4), realtime (§5), security (§6), NFRs (§7), testing (§8), design system (§9), milestones (§10), and — most importantly — the **Definition of Done and acceptance gates (§11)**. Treat §4 (data model) and §11 (DoD) as binding contracts.

**WHAT WE'RE BUILDING.** **Two surfaces only**, sharing one backend and one `packages/shared`:
1. **Customer App** (Expo React Native, TS) — the ONLY mobile app — browse→cart→checkout(COD first)→track→reorder. It is READ-ONLY on catalog/price/stock (it never defines them) and only writes orders.
2. **Web Dashboard** (React + Vite, TS) — ONE role-gated web app, **not** a mobile/native app — that contains BOTH:
   - **Central Command (HQ/admin):** receives every order from every branch in real time (all-orders firehose); owns the master catalog; controls exactly what each customer sees (per-product master `is_active` + per-branch `branch_products.is_listed`); controls quantity/stock per product per branch; pricing/promotions; branches/zones; reports; staff/roles.
   - **Branch Operations (operator/manager):** branch-scoped order queue, pick/pack/confirm, live stock adjust, courier handoff, returns.
There is NO operations mobile app. Operators use the web dashboard in a browser (tablet-friendly). The dashboard's catalog/inventory/pricing tables are the single source of truth; the customer app reads the derived `customer_catalog(branch_id)` view and writes orders back.
The three hard problems — **race-safe per-branch stock**, **geo branch-routing**, **live order/courier tracking** — are the spine; build/de-risk them first.

**STACK.** Customer app: Expo RN + TypeScript + Expo Router + TanStack Query + Zustand + React Hook Form + Zod (shared schemas) + react-native-maps. Web Dashboard: React/Vite/Tailwind(tokenized)/TanStack Query/TanStack Table/Recharts + a map lib for zone polygons + a realtime client for the orders firehose & stock. Backend: **propose Supabase (Path A) vs NestJS+Prisma+Postgres+Redis (Path B) in ADR-0001 and ask me to confirm before scaffolding the backend.** Payments: Paymob behind a `PaymentProvider` interface, COD first-class. Geo via PostGIS or polygon-in-Postgres. Monorepo via pnpm workspaces/Turborepo with `apps/customer`, `apps/dashboard`, `packages/shared` (no `apps/ops`). CI via GitHub Actions (typecheck+lint+test gate). Sentry on both surfaces.

**HOW YOU WORK — non-negotiable loop for every task:**
1. **Plan:** restate the task, list files you'll touch, name the acceptance test from §11 (or define one), and the states you'll handle (loading/empty/error/offline).
2. **Confirm** any architectural decision via a short ADR and wait for my OK if it's a Path-level or schema-level choice.
3. **Implement** the smallest shippable slice. Shared types/schemas go in `packages/shared` — never duplicate a shape.
4. **Test:** write the test(s) that prove the acceptance criterion (unit/integration/component/E2E as appropriate per §8). Money/stock/authz paths require automated proof.
5. **Verify:** run typecheck + lint + tests. Paste the command output. If anything is red, it's not done.
6. **Report:** update `docs/STATUS.md` with the item, its acceptance evidence (test name/output), and what's next. Use Conventional Commits, one concern per PR.
7. **Never** mark done without the §11 DoD satisfied. "Compiles/renders" ≠ done.

**SERVER-AUTHORITATIVE RULES (do not violate):** stock decrement, price calculation, promo application, order placement, and payment status are computed and enforced on the server in transactions; the client is display-only for these. The customer app never defines catalog/price/stock — it reads the `customer_catalog(branch_id)` view and writes orders. Implement the reservation model and atomic check-and-decrement from §4. Enforce idempotency on checkout and payment webhooks. Enforce role-based access (customer / branch-operator / branch-manager / HQ-admin) and write negative authz tests (a customer can't read another customer's order; an operator can't read another branch's orders or edit the master catalog; only HQ-admin edits master catalog/prices/visibility).

**EXECUTION ORDER (follow §10 phases; gate each):**
- **Phase 0:** monorepo + CI + shared theme/primitives + schema migration + RLS scaffold; then the three spikes (S1 oversell-safe decrement, S2 address→branch zone, S3 realtime status+reconnect). Do not proceed to Phase 1 until all three spikes demonstrably pass and ADR-0001 is accepted.
- **Phase 1:** customer golden path (COD). Gate: golden-path E2E + oversell load test + server price recompute all green.
- **Phase 2 (Web Dashboard — Central Command):** master catalog, per-product + per-branch visibility control, stock/quantity control per branch, pricing/promotions, the real-time all-orders firehose, branches/zones, staff/roles, audit_log. Gate: HQ creates branch+zone+product+stock and lists it → it becomes visible & orderable in the customer app for an in-zone address with no DB hand-edits; HQ unpublishes → it disappears live; a customer order shows in the all-orders feed in real time.
- **Phase 3 (Web Dashboard — Branch Operations):** branch-scoped realtime order queue, pick/pack/confirm status machine, live stock adjust, courier assign/handoff, returns, reports. Gate: a customer order appears live in the branch queue, is drivable through the full status machine, the customer sees each transition live, and operator stock changes reflect in the app and roll up to Central Command.
- **Phase 4:** Paymob + webhooks + idempotency + refunds + push + Sentry + perf/a11y pass + EAS submit. Gate: paid order via webhook, refund works, NFRs (§7) met.
- **Phase 5 (deferred):** loyalty, in-app chat, web storefront, recommendations.

**DESIGN.** Use B-Systems tokens (§9): Systems Indigo anchor, Signal Pink for CTAs only (~12%), Paper canvas, Cairo for Arabic, RTL-correct by default, 44px tap targets, full loading/empty/error/offline states on every screen.

**DELIVERABLES PER PHASE:** working apps runnable via documented commands; passing test suite; updated `docs/STATUS.md` and ADRs; a short demo script proving each phase's acceptance gate.

**START NOW BY:** (a) reading this plan, (b) producing the Phase-0 task breakdown with the exact acceptance test for each item, (c) drafting ADR-0001 (backend Path A vs B) with your recommendation, and (d) asking me to confirm the backend path before you scaffold it. Do not scaffold the backend until I confirm. After confirmation, set up the monorepo + CI + shared package, then implement the three Phase-0 spikes and show me the passing acceptance evidence for each.

---

*End of plan. Keep this file in the repo and re-read it at the top of every Claude Code session.*
