import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApiTestDb, type ApiTestDb } from './harness';

let db: ApiTestDb;

beforeAll(async () => {
  db = await startApiTestDb(54340);
});
afterAll(async () => {
  await db?.stop();
});

describe('API DB toolchain smoke (Prisma + embedded-postgres + DDL + view)', () => {
  it('applies the schema and round-trips a Branch through Prisma Client', async () => {
    const branch = await db.prisma.branch.create({
      data: { name: 'فرع المعادي', lat: 29.96, lng: 31.25 },
    });
    expect(branch.id).toMatch(/[0-9a-f-]{36}/);
    const found = await db.prisma.branch.findUnique({ where: { id: branch.id } });
    expect(found?.name).toBe('فرع المعادي');
  });

  it('enforces the qty_available >= 0 CHECK from extras.sql', async () => {
    const cat = await db.prisma.category.create({ data: { nameAr: 'ألبان', nameEn: 'Dairy' } });
    const product = await db.prisma.product.create({
      data: { sku: 'SKU-1', nameAr: 'لبن', nameEn: 'Milk', categoryId: cat.id, basePrice: 2500, unit: 'ea' },
    });
    const branch = await db.prisma.branch.create({ data: { name: 'B', lat: 30, lng: 31 } });
    const inv = await db.prisma.inventory.create({
      data: { productId: product.id, branchId: branch.id, qtyAvailable: 0, qtyReserved: 0 },
    });
    await expect(
      db.prisma.inventory.update({ where: { id: inv.id }, data: { qtyAvailable: -1 } }),
    ).rejects.toThrow();
  });

  it('exposes the customer_catalog view (queryable)', async () => {
    const rows = await db.prisma.$queryRawUnsafe<unknown[]>('SELECT * FROM customer_catalog');
    expect(Array.isArray(rows)).toBe(true);
  });
});
