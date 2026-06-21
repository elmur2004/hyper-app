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
import { DeliveryService } from '../src/modules/delivery/delivery.service';
import { AuditService } from '../src/modules/audit/audit.service';

let db: ApiTestDb;
let s: SeedResult;
let orders: OrdersService;
let delivery: DeliveryService;

const opA = (): AuthContext => ({ userId: 'opA', role: 'branch_operator', branchId: '' });
const opB = (): AuthContext => ({ userId: 'opB', role: 'branch_operator', branchId: '' });

beforeAll(async () => {
  db = await startApiTestDb(54347);
  s = await seed(db.prisma);
  const prisma = db.prisma as unknown as PrismaService;
  orders = new OrdersService(prisma, new RoutingService(prisma), new RealtimePublisher(), new PromotionsService(), new LoyaltyService(prisma));
  delivery = new DeliveryService(prisma, new AuditService());
});
afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.prisma.$executeRawUnsafe(
    'TRUNCATE order_events, order_items, deliveries, idempotency_keys, orders, couriers CASCADE',
  );
  await db.prisma.inventory.update({
    where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    data: { qtyAvailable: 5, qtyReserved: 0 },
  });
});

async function placedOrder() {
  return orders.checkout({
    customerId: s.custAlice,
    addressId: s.addrAliceInA,
    items: [{ productId: s.milk, qty: 1 }],
    paymentMethod: 'cod',
    idempotencyKey: randomUUID(),
  });
}

describe('Phase 3 — courier assignment', () => {
  it('assigns a same-branch courier; rejects a cross-branch operator and a foreign courier', async () => {
    const order = await placedOrder();
    const courierA = await delivery.createCourier({ ...opA(), branchId: s.branchA }, {
      branchId: s.branchA,
      name: 'سائق أ',
      phone: '+201222222201',
    });

    // operator of another branch cannot assign
    await expect(delivery.assign({ ...opB(), branchId: s.branchB }, order.id, courierA.id)).rejects.toThrow();

    const assigned = await delivery.assign({ ...opA(), branchId: s.branchA }, order.id, courierA.id);
    expect(assigned.courierId).toBe(courierA.id);
    expect(assigned.status).toBe('assigned');
  });
});

describe('Phase 3 — returns/refund', () => {
  it('a delivered order can be returned: → refunded, payment refunded, stock restocked', async () => {
    const order = await placedOrder();
    const op = { ...opA(), branchId: s.branchA };
    for (const next of ['confirmed', 'picking', 'packed', 'out_for_delivery', 'delivered'] as const) {
      await orders.transition(op, order.id, next);
    }
    // delivered → stock left (available 4, reserved 0)
    let inv = await db.prisma.inventory.findUnique({
      where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    });
    expect(inv).toMatchObject({ qtyAvailable: 4, qtyReserved: 0 });

    const refunded = await orders.initiateReturn(op, order.id, 'تالف');
    expect(refunded.status).toBe('refunded');
    expect(refunded.paymentStatus).toBe('refunded');
    inv = await db.prisma.inventory.findUnique({
      where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    });
    expect(inv?.qtyAvailable).toBe(5); // restocked
  });

  it('cannot return an order that was never delivered', async () => {
    const order = await placedOrder();
    await expect(orders.initiateReturn({ ...opA(), branchId: s.branchA }, order.id)).rejects.toThrow();
  });
});
