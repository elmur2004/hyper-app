import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { startApiTestDb, type ApiTestDb } from './harness';
import { seed, type SeedResult } from './seed';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { RoutingService } from '../src/modules/routing/routing.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';

let db: ApiTestDb;
let s: SeedResult;
let inventory: InventoryService;
let routing: RoutingService;
let catalog: CatalogService;

beforeAll(async () => {
  db = await startApiTestDb(54341);
  s = await seed(db.prisma);
  const prisma = db.prisma as unknown as PrismaService;
  inventory = new InventoryService(prisma);
  routing = new RoutingService(prisma);
  catalog = new CatalogService(prisma);
});
afterAll(async () => {
  await db?.stop();
});

describe('CatalogService — customer_catalog visibility predicate (§4)', () => {
  it('shows only active AND listed AND in-stock AND priced products', async () => {
    const rows = await catalog.forBranch(s.branchA);
    const skus = rows.map((r) => r.productId).sort();
    // milk = visible; bread = out of stock; eggs = master-inactive; cheese = no price → only milk
    expect(skus).toEqual([s.milk]);
    expect(rows[0]?.price).toBe(4500); // branch price wins over base
  });
});

describe('RoutingService — branch resolution (§11)', () => {
  it('resolves an in-zone point to its branch and rejects an out-of-zone point', async () => {
    const inZone = await routing.resolve({ lat: 30.02, lng: 31.02 });
    expect(inZone.status).toBe('in_zone');
    if (inZone.status === 'in_zone') expect(inZone.branchId).toBe(s.branchA);

    const outside = await routing.resolve({ lat: 10, lng: 10 });
    expect(outside).toEqual({ status: 'not_deliverable', reason: 'outside_all_zones' });
  });
});

describe('InventoryService — oversell gate (§11) graduated into the API', () => {
  it('20 concurrent reservations for the qty=1 SKU → exactly one succeeds', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => inventory.place(s.branchA, s.milk, 1)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === 'OUT_OF_STOCK')).toHaveLength(19);
    const inv = await db.prisma.inventory.findUnique({
      where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    });
    expect(inv?.qtyAvailable).toBe(0);
    expect(inv?.qtyReserved).toBe(1);
  });
});
