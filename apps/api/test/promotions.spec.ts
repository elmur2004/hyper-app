import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../src/prisma/prisma.service';
import { startApiTestDb, type ApiTestDb } from './harness';
import { seed, type SeedResult } from './seed';
import { OrdersService } from '../src/modules/orders/orders.service';
import { RoutingService } from '../src/modules/routing/routing.service';
import { RealtimePublisher } from '../src/common/realtime.publisher';
import { PromotionsService } from '../src/modules/promotions/promotions.service';
import { LoyaltyService } from '../src/modules/loyalty/loyalty.service';

let db: ApiTestDb;
let s: SeedResult;
let orders: OrdersService;

beforeAll(async () => {
  db = await startApiTestDb(54346);
  s = await seed(db.prisma);
  const prisma = db.prisma as unknown as PrismaService;
  orders = new OrdersService(prisma, new RoutingService(prisma), new RealtimePublisher(), new PromotionsService(), new LoyaltyService(prisma));
});
afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.prisma.$executeRawUnsafe(
    'TRUNCATE order_events, order_items, deliveries, idempotency_keys, orders CASCADE',
  );
  await db.prisma.inventory.update({
    where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    data: { qtyAvailable: 10, qtyReserved: 0 },
  });
  await db.prisma.promotion.deleteMany();
});

const checkout = (promoCode?: string) =>
  orders.checkout({
    customerId: s.custAlice,
    addressId: s.addrAliceInA,
    items: [{ productId: s.milk, qty: 2 }], // 2 × 4500 = 9000 subtotal
    paymentMethod: 'cod',
    idempotencyKey: randomUUID(),
    promoCode,
  });

describe('Phase 2 — promotions (server-enforced at checkout)', () => {
  it('applies a percentage discount and recomputes the total server-side', async () => {
    await db.prisma.promotion.create({
      data: { code: 'EID10', type: 'pct', value: 10, minSubtotal: 0, startsAt: new Date(0), endsAt: new Date('2999-01-01'), active: true },
    });
    const order = await checkout('EID10');
    expect(order.subtotal).toBe(9000);
    expect(order.discount).toBe(900); // 10% of 9000
    expect(order.total).toBe(9000 + 2000 - 900);
  });

  it('rejects an expired promo', async () => {
    await db.prisma.promotion.create({
      data: { code: 'OLD', type: 'fixed', value: 1000, minSubtotal: 0, startsAt: new Date(0), endsAt: new Date('2000-01-01'), active: true },
    });
    await expect(checkout('OLD')).rejects.toThrow(/expired/);
  });

  it('rejects when subtotal is below the promo minimum', async () => {
    await db.prisma.promotion.create({
      data: { code: 'BIG', type: 'fixed', value: 1000, minSubtotal: 100000, startsAt: new Date(0), endsAt: new Date('2999-01-01'), active: true },
    });
    await expect(checkout('BIG')).rejects.toThrow(/minimum/);
  });

  it('checkout without a promo has zero discount', async () => {
    const order = await checkout();
    expect(order.discount).toBe(0);
    expect(order.total).toBe(11000);
  });
});
