# Hyper — Hypermarket E-Commerce & Delivery Platform

Two surfaces over one backend and one `packages/shared`:
- **Customer app** (Expo React Native) — browse → cart → checkout (COD) → track → reorder. Read-only on catalog/price/stock.
- **Web Dashboard** (React + Vite) — one role-gated app = HQ **Central Command** + **Branch Operations**.

Backend: **NestJS + Prisma + Postgres** (ADR-0001). Server-authoritative for stock, price, orders, payments.

## Quick start
```bash
pnpm install            # pnpm 9.15.4, Node 22
pnpm -w typecheck       # 6/6
pnpm -w lint            # 6/6
pnpm -w test            # 94 tests (real Postgres via embedded-postgres; no Docker)
pnpm -w build
```

## Workspace
| Package | What |
|---|---|
| `packages/shared` | §4 Zod schemas, order status machine, theme tokens, RTL UI primitives, typed API client |
| `packages/db` | the three Phase-0 spikes (oversell / geo / realtime) + embedded-postgres test harness |
| `apps/api` | NestJS + Prisma: catalog, orders/checkout, admin (Central Command), payments, auth |
| `apps/dashboard` | React + Vite Central Command (RBAC routing, orders firehose, catalog) |
| `apps/customer` | verified cart/checkout/status logic + Expo RN screens (reference) |

## Docs
- [docs/ENGINEERING_PLAN.md](docs/ENGINEERING_PLAN.md) — the binding plan (re-read each session)
- [docs/STATUS.md](docs/STATUS.md) — what's done, with acceptance evidence
- [docs/DEMO.md](docs/DEMO.md) — commands proving each phase gate
- [docs/PHASE-0-BREAKDOWN.md](docs/PHASE-0-BREAKDOWN.md) — Phase-0 tasks + acceptance tests
- [docs/adr/](docs/adr/) — 0001 backend choice · 0002 spike outcomes · 0003 implementation decisions

See [docs/STATUS.md](docs/STATUS.md) for what requires external resources (managed PostGIS/realtime, Paymob keys, SMS provider, Expo device/EAS) and the Phase-5 deferrals.
