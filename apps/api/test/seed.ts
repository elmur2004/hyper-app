import type { PrismaClient } from '@prisma/client';
import type { GeoJsonPolygon } from '@hyper/shared';

/** Axis-aligned square ring ([lng, lat]). */
const square = (latMin: number, latMax: number, lngMin: number, lngMax: number): GeoJsonPolygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [lngMin, latMin],
      [lngMax, latMin],
      [lngMax, latMax],
      [lngMin, latMax],
      [lngMin, latMin],
    ],
  ],
});

export interface SeedResult {
  branchA: string;
  branchB: string;
  category: string;
  milk: string; // listed in A, in stock, priced
  bread: string; // listed in A but OUT of stock
  eggs: string; // master-inactive
  cheese: string; // listed in A, in stock, but NO price row
  custAlice: string;
  custBob: string;
  addrAliceInA: string;
  operatorA: string;
  operatorB: string;
  admin: string;
}

/**
 * Deterministic substrate for the integration tests: two branches with zones, four products
 * exercising every customer_catalog visibility case, inventory (incl. a qty=1 SKU), prices,
 * two customers + an in-zone address, and one staff principal per scope.
 */
export async function seed(prisma: PrismaClient): Promise<SeedResult> {
  const branchA = await prisma.branch.create({ data: { name: 'فرع المعادي', lat: 30.0, lng: 31.0 } });
  const branchB = await prisma.branch.create({ data: { name: 'فرع مدينة نصر', lat: 30.5, lng: 31.5 } });

  await prisma.deliveryZone.create({
    data: { branchId: branchA.id, priority: 1, polygon: square(30.0, 30.1, 31.0, 31.1) as object },
  });
  await prisma.deliveryZone.create({
    data: { branchId: branchB.id, priority: 1, polygon: square(30.5, 30.6, 31.5, 31.6) as object },
  });

  const category = await prisma.category.create({ data: { nameAr: 'بقالة', nameEn: 'Grocery' } });

  const mk = (sku: string, nameAr: string, isActive = true) =>
    prisma.product.create({
      data: { sku, nameAr, nameEn: sku, categoryId: category.id, basePrice: 5000, unit: 'ea', isActive },
    });
  const milk = await mk('MILK', 'لبن');
  const bread = await mk('BREAD', 'عيش');
  const eggs = await mk('EGGS', 'بيض', false); // master-inactive
  const cheese = await mk('CHEESE', 'جبنة');

  // Branch A listings + inventory + prices
  for (const p of [milk, bread, eggs, cheese]) {
    await prisma.branchProduct.create({ data: { productId: p.id, branchId: branchA.id, isListed: true } });
  }
  await prisma.inventory.create({ data: { productId: milk.id, branchId: branchA.id, qtyAvailable: 1 } }); // qty=1 for oversell
  await prisma.inventory.create({ data: { productId: bread.id, branchId: branchA.id, qtyAvailable: 0 } }); // OOS
  await prisma.inventory.create({ data: { productId: eggs.id, branchId: branchA.id, qtyAvailable: 10 } });
  await prisma.inventory.create({ data: { productId: cheese.id, branchId: branchA.id, qtyAvailable: 10 } });

  // Prices: milk has a branch price; cheese has NO price row (excluded from catalog).
  await prisma.price.create({ data: { productId: milk.id, branchId: branchA.id, price: 4500 } });
  await prisma.price.create({ data: { productId: bread.id, branchId: null, price: 2000 } });
  await prisma.price.create({ data: { productId: eggs.id, branchId: null, price: 3000 } });

  const custAlice = await prisma.customer.create({ data: { phone: '+201000000001', name: 'أليس' } });
  const custBob = await prisma.customer.create({ data: { phone: '+201000000002', name: 'بوب' } });
  const addrAliceInA = await prisma.address.create({
    data: { customerId: custAlice.id, label: 'المنزل', lat: 30.02, lng: 31.02, text: 'المعادي', isDefault: true },
  });

  const operatorA = await prisma.staffUser.create({
    data: { branchId: branchA.id, role: 'branch_operator', phone: '+201111111101', name: 'مشغل أ' },
  });
  const operatorB = await prisma.staffUser.create({
    data: { branchId: branchB.id, role: 'branch_operator', phone: '+201111111102', name: 'مشغل ب' },
  });
  const admin = await prisma.staffUser.create({
    data: { branchId: null, role: 'hq_admin', phone: '+201111111100', name: 'المدير' },
  });

  return {
    branchA: branchA.id,
    branchB: branchB.id,
    category: category.id,
    milk: milk.id,
    bread: bread.id,
    eggs: eggs.id,
    cheese: cheese.id,
    custAlice: custAlice.id,
    custBob: custBob.id,
    addrAliceInA: addrAliceInA.id,
    operatorA: operatorA.id,
    operatorB: operatorB.id,
    admin: admin.id,
  };
}
