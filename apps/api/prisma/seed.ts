/**
 * One-command demo seed (`pnpm --filter @hyper/api seed`, or `prisma db seed`).
 *
 * Produces a fully browseable dataset: two branches with delivery zones, a handful of
 * Arabic-first products that all satisfy the `customer_catalog` predicate
 * (master-active ∧ listed-for-branch ∧ in stock ∧ priced), two customers with in-zone
 * addresses, one staff principal per scope, couriers, and a welcome promotion.
 *
 * Idempotent: wipes the domain tables first, so it is safe to re-run.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Axis-aligned square ring ([lng, lat]) — matches the S2 spike's zone shape. */
const square = (latMin: number, latMax: number, lngMin: number, lngMax: number) => ({
  type: 'Polygon' as const,
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

/** Delete domain rows children-first so re-running the seed never trips a FK. */
async function wipe(): Promise<void> {
  await prisma.loyaltyLedger.deleteMany();
  await prisma.loyaltyAccount.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.price.deleteMany();
  await prisma.branchProduct.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.staffUser.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.branch.deleteMany(); // last: everything that references a branch is cleared above
}

interface ProductSpec {
  sku: string;
  nameAr: string;
  nameEn: string;
  category: string;
  /** Base price in piastres (1 EGP = 100). */
  price: number;
  qty: number;
  unit: string;
  /** Keyword for the demo thumbnail (food-relevant image via loremflickr). */
  img: string;
}

/** Deterministic, food-relevant demo thumbnail for a keyword. */
const thumb = (keyword: string): string => `https://loremflickr.com/320/320/${encodeURIComponent(keyword)}`;

const CATALOG: ProductSpec[] = [
  { sku: 'MILK', nameAr: 'لبن كامل الدسم 1 لتر', nameEn: 'Full-fat milk 1L', category: 'منتجات الألبان', price: 4500, qty: 40, unit: 'علبة', img: 'milk' },
  { sku: 'CHEESE', nameAr: 'جبنة بيضاء 500 جم', nameEn: 'White cheese 500g', category: 'منتجات الألبان', price: 8500, qty: 25, unit: 'عبوة', img: 'cheese' },
  { sku: 'YOGURT', nameAr: 'زبادي 6 علب', nameEn: 'Yogurt 6-pack', category: 'منتجات الألبان', price: 6000, qty: 30, unit: 'عبوة', img: 'yogurt' },
  { sku: 'BREAD', nameAr: 'عيش فينو 5 قطع', nameEn: 'Bread rolls x5', category: 'مخبوزات', price: 2000, qty: 60, unit: 'عبوة', img: 'bread' },
  { sku: 'EGGS', nameAr: 'بيض أحمر 30 بيضة', nameEn: 'Eggs (tray of 30)', category: 'مخبوزات', price: 9000, qty: 35, unit: 'طبق', img: 'eggs' },
  { sku: 'RICE', nameAr: 'أرز مصري 5 كجم', nameEn: 'Egyptian rice 5kg', category: 'بقالة جافة', price: 14000, qty: 20, unit: 'كيس', img: 'rice' },
  { sku: 'OIL', nameAr: 'زيت عباد الشمس 1.5 لتر', nameEn: 'Sunflower oil 1.5L', category: 'بقالة جافة', price: 11000, qty: 18, unit: 'زجاجة', img: 'cooking-oil' },
  { sku: 'WATER', nameAr: 'مياه معدنية 1.5 لتر', nameEn: 'Mineral water 1.5L', category: 'مشروبات', price: 700, qty: 100, unit: 'زجاجة', img: 'water-bottle' },
  { sku: 'BANANA', nameAr: 'موز 1 كجم', nameEn: 'Bananas 1kg', category: 'خضار وفاكهة', price: 3500, qty: 50, unit: 'كجم', img: 'banana' },
  { sku: 'TOMATO', nameAr: 'طماطم 1 كجم', nameEn: 'Tomatoes 1kg', category: 'خضار وفاكهة', price: 2500, qty: 45, unit: 'كجم', img: 'tomato' },
];

async function main(): Promise<void> {
  await wipe();

  // Stable ids so re-seeding never invalidates EXPO_PUBLIC_DEMO_BRANCH_ID / saved configs.
  const branchA = await prisma.branch.create({
    data: { id: '11111111-1111-4111-8111-111111111111', name: 'فرع المعادي', lat: 30.0, lng: 31.0 },
  });
  const branchB = await prisma.branch.create({
    data: { id: '22222222-2222-4222-8222-222222222222', name: 'فرع مدينة نصر', lat: 30.5, lng: 31.5 },
  });

  await prisma.deliveryZone.create({
    data: { branchId: branchA.id, priority: 1, polygon: square(30.0, 30.1, 31.0, 31.1) },
  });
  await prisma.deliveryZone.create({
    data: { branchId: branchB.id, priority: 1, polygon: square(30.5, 30.6, 31.5, 31.6) },
  });

  // Categories (deduped by Arabic name).
  const categoryIds = new Map<string, string>();
  for (const name of new Set(CATALOG.map((p) => p.category))) {
    const cat = await prisma.category.create({ data: { nameAr: name, nameEn: name } });
    categoryIds.set(name, cat.id);
  }

  // Every product is listed + stocked + priced in BOTH branches → all visible in catalog.
  for (const spec of CATALOG) {
    const product = await prisma.product.create({
      data: {
        sku: spec.sku,
        nameAr: spec.nameAr,
        nameEn: spec.nameEn,
        categoryId: categoryIds.get(spec.category)!,
        basePrice: spec.price,
        unit: spec.unit,
        imageUrls: [thumb(spec.img)],
        isActive: true,
      },
    });
    // Base price for all branches.
    await prisma.price.create({ data: { productId: product.id, branchId: null, price: spec.price } });
    for (const branch of [branchA, branchB]) {
      await prisma.branchProduct.create({ data: { productId: product.id, branchId: branch.id, isListed: true } });
      await prisma.inventory.create({ data: { productId: product.id, branchId: branch.id, qtyAvailable: spec.qty } });
    }
  }

  // A branch-A-only discount on milk demonstrates branch price override (branch price wins).
  const milk = await prisma.product.findUniqueOrThrow({ where: { sku: 'MILK' } });
  await prisma.price.create({ data: { productId: milk.id, branchId: branchA.id, price: 3900 } });

  // Customers + in-zone default addresses.
  const alice = await prisma.customer.create({ data: { phone: '+201000000001', name: 'أليس' } });
  const bob = await prisma.customer.create({ data: { phone: '+201000000002', name: 'بوب' } });
  await prisma.address.create({
    data: { customerId: alice.id, label: 'المنزل', lat: 30.02, lng: 31.02, text: 'شارع 9، المعادي', isDefault: true },
  });
  await prisma.address.create({
    data: { customerId: bob.id, label: 'العمل', lat: 30.52, lng: 31.52, text: 'عباس العقاد، مدينة نصر', isDefault: true },
  });

  // Staff: one HQ admin + one operator per branch.
  await prisma.staffUser.create({ data: { branchId: null, role: 'hq_admin', phone: '+201111111100', name: 'مدير عام' } });
  await prisma.staffUser.create({ data: { branchId: branchA.id, role: 'branch_operator', phone: '+201111111101', name: 'مشغل المعادي' } });
  await prisma.staffUser.create({ data: { branchId: branchB.id, role: 'branch_operator', phone: '+201111111102', name: 'مشغل مدينة نصر' } });

  // Couriers (for the assign-courier / delivery flow).
  await prisma.courier.create({ data: { branchId: branchA.id, name: 'سائق المعادي', phone: '+201222222201' } });
  await prisma.courier.create({ data: { branchId: branchB.id, name: 'سائق مدينة نصر', phone: '+201222222202' } });

  // A welcome promotion (10% off over 50 EGP), valid for a year from a fixed epoch.
  await prisma.promotion.create({
    data: {
      code: 'WELCOME10',
      type: 'pct',
      value: 10,
      minSubtotal: 5000,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      endsAt: new Date('2027-01-01T00:00:00Z'),
      active: true,
    },
  });

  // Summary for the operator running the seed.
  /* eslint-disable no-console */
  console.log('\n✅ Seed complete.\n');
  console.log(`  Branch A (المعادي)     ${branchA.id}`);
  console.log(`  Branch B (مدينة نصر)   ${branchB.id}`);
  console.log(`  Products listed:       ${CATALOG.length} (all visible in both branches)\n`);
  console.log('  Customer logins (OTP — dev returns the code in the response):');
  console.log('    +201000000001  (أليس, address in branch A)');
  console.log('    +201000000002  (بوب, address in branch B)\n');
  console.log('  Staff logins (POST /auth/staff/login):');
  console.log('    +201111111100  hq_admin');
  console.log('    +201111111101  branch_operator (A)');
  console.log('    +201111111102  branch_operator (B)\n');
  console.log('  Point the apps at branch A:');
  console.log(`    dashboard / curl:  /catalog?branchId=${branchA.id}`);
  console.log(`    customer app .env: EXPO_PUBLIC_DEMO_BRANCH_ID=${branchA.id}\n`);
  /* eslint-enable no-console */
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
