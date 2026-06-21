# Running & testing the platform

## Prerequisites
- **Node 20+** and **pnpm 9** (`corepack enable` or `npm i -g pnpm@9`).
- Internet on first install (npm packages + the embedded-postgres binary the tests use).
- No Docker or local Postgres needed **for the tests** — they boot a real Postgres in-process.

```bash
pnpm install
```

---

## 1. Run everything as tests (recommended — zero external setup)

The test suite is the source of truth: it boots a **real Postgres** (`embedded-postgres`, UTF-8)
per package, applies the schema, and exercises every gate (oversell, geo routing, realtime,
checkout/idempotency/price-integrity, RBAC, promotions, courier/returns, loyalty, the live Nest
app over HTTP).

```bash
pnpm -w test          # all packages — ~106 tests
pnpm -w typecheck     # 6/6
pnpm -w lint          # 6/6
pnpm -w build         # shared (tsup) · api (tsc) · dashboard (vite)
```

Run one package, or one spec:
```bash
pnpm --filter @hyper/db   test                       # the 3 Phase-0 spikes (S1/S2/S3)
pnpm --filter @hyper/api  test                       # full backend
pnpm --filter @hyper/api  test test/orders.spec.ts   # one file (golden path, oversell, authz, …)
pnpm --filter @hyper/dashboard test                  # operator UI components
```
See [DEMO.md](DEMO.md) for which spec proves which §11 acceptance gate.

> First `pnpm -w test` is slower (downloads the Postgres binary). Each spec file boots its own
> Postgres on a fixed port (54329–54348); they run serially, so a full run is a few minutes.

---

## 2. Run the live API server

The live server needs a **real Postgres** (the embedded one is test-only). Easiest is a free
**Neon** database (it also gives you PostGIS to later graduate the geo resolver). Then:

```bash
export DATABASE_URL='postgresql://USER:PASS@HOST:5432/db?sslmode=require'
export AUTH_TOKEN_SECRET='change-me'        # signs OTP session tokens
# export PAYMOB_HMAC_SECRET='...'           # only for online-payment webhook verification

cd apps/api
pnpm exec prisma generate
pnpm exec prisma db push --skip-generate                                   # tables + enums
pnpm exec prisma db execute --file prisma/extras.sql --schema prisma/schema.prisma  # CHECK constraints + customer_catalog view
pnpm build && pnpm start                    # → API listening on :3000
```

Smoke-test it:
```bash
# public browse
curl 'http://localhost:3000/catalog?branchId=<id>'
# OTP login (dev returns the code in the response)
curl -XPOST localhost:3000/auth/otp/request -H 'content-type: application/json' -d '{"phone":"+201000000001"}'
curl -XPOST localhost:3000/auth/otp/verify  -H 'content-type: application/json' -d '{"phone":"+201000000001","code":"<devCode>"}'
```

> The DB starts empty. To get browseable data, either drive the admin API with an HQ-admin token
> (create branch → zone → product → stock → list it), or adapt `apps/api/test/seed.ts` into a
> `prisma db seed` script. Ask me and I'll wire a one-command seed + `pnpm --filter @hyper/api dev`.

---

## 3. Run the dashboard (web)

```bash
# point it at your running API (defaults to http://localhost:3000)
echo 'VITE_API_URL=http://localhost:3000' > apps/dashboard/.env.local
pnpm --filter @hyper/dashboard dev          # Vite dev server (Login → orders firehose / catalog admin)
```
RBAC-gated routes; log in with a staff phone via the dev staff login. Build for prod: `pnpm --filter @hyper/dashboard build && pnpm --filter @hyper/dashboard preview`.

---

## 4. Customer app (Expo / React Native)

The customer surface's logic (cart, checkout client, order presenter) is unit/component-tested
(`pnpm --filter @hyper/customer test`). Running it on a device/emulator needs the Expo toolchain
and is not wired as a one-command `start` here (no device in CI). To run it locally you'd add
`expo` + an `expo start` script and an emulator/Expo Go — happy to wire that on request.

---

## What needs external credentials (documented, not runnable in a bare checkout)
- **Managed PostGIS** (Neon/RDS/Crunchy) to swap S2's resolver to the real `ST_Covers`/`ST_Distance` query.
- **Paymob** API key + exact HMAC field order for live online payments (COD works without it).
- **SMS/OTP provider**, **image storage** (S3/R2), **managed realtime** (Ably/Pusher), and **EAS/Apple/Google** accounts for store builds.
