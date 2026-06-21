import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthContext } from '../src/common/authz';
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
let loyalty: LoyaltyService;

const op = (): AuthContext => ({ userId: 'opA', role: 'branch_operator', branchId: '' });

beforeAll(async () => {
  db = await startApiTestDb(54348);
  s = await seed(db.prisma);
  const prisma = db.prisma as unknown as PrismaService;
  loyalty = new LoyaltyService(prisma);
  orders = new OrdersService(prisma, new RoutingService(prisma), new RealtimePublisher(), new PromotionsService(), loyalty);
});
afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.prisma.$executeRawUnsafe(
    'TRUNCATE order_events, order_items, deliveries, idempotency_keys, orders, loyalty_ledger, loyalty_accounts CASCADE',
  );
  await db.prisma.inventory.update({
    where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    data: { qtyAvailable: 5, qtyReserved: 0 },
  });
});

async function deliverOne() {
  const order = await orders.checkout({
    customerId: s.custAlice,
    addressId: s.addrAliceInA,
    items: [{ productId: s.milk, qty: 1 }],
    paymentMethod: 'cod',
    idempotencyKey: randomUUID(),
  });
  for (const next of ['confirmed', 'picking', 'packed', 'out_for_delivery', 'delivered'] as const) {
    await orders.transition({ ...op(), branchId: s.branchA }, order.id, next);
  }
  return order;
}

describe('Phase 5 — loyalty points', () => {
  it('earns points on delivery (1 per EGP of the order total)', async () => {
    expect(await loyalty.balance(s.custAlice)).toBe(0);
    await deliverOne(); // total 6500 piastres → 65 points
    expect(await loyalty.balance(s.custAlice)).toBe(65);
  });

  it('reverses points when the order is returned', async () => {
    const order = await deliverOne();
    expect(await loyalty.balance(s.custAlice)).toBe(65);
    await orders.initiateReturn({ ...op(), branchId: s.branchA }, order.id);
    expect(await loyalty.balance(s.custAlice)).toBe(0);
  });
});
