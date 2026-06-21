import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { orderChannelName, InvalidTransitionError } from '@hyper/shared';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthContext } from '../src/common/authz';
import { startApiTestDb, type ApiTestDb } from './harness';
import { seed, type SeedResult } from './seed';
import { RoutingService } from '../src/modules/routing/routing.service';
import { RealtimePublisher } from '../src/common/realtime.publisher';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PromotionsService } from '../src/modules/promotions/promotions.service';
import { LoyaltyService } from '../src/modules/loyalty/loyalty.service';

let db: ApiTestDb;
let s: SeedResult;
let orders: OrdersService;

const customer = (id: string): AuthContext => ({ userId: id, role: 'customer', branchId: null });
const operator = (id: string, branchId: string): AuthContext => ({
  userId: id,
  role: 'branch_operator',
  branchId,
});

beforeAll(async () => {
  db = await startApiTestDb(54342);
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
    data: { qtyAvailable: 1, qtyReserved: 0 },
  });
});

const checkoutMilk = (key = randomUUID(), hint?: number) =>
  orders.checkout({
    customerId: s.custAlice,
    addressId: s.addrAliceInA,
    items: [{ productId: s.milk, qty: 1, clientPriceHint: hint }],
    paymentMethod: 'cod',
    idempotencyKey: key,
  });

describe('Phase 1 — golden path (COD)', () => {
  it('browse→checkout→track→delivered, server-priced, stock reserved then fulfilled', async () => {
    const order = await checkoutMilk();
    expect(order.status).toBe('placed');
    expect(order.branchId).toBe(s.branchA); // routed from the address
    expect(order.items[0]?.unitPrice).toBe(4500); // branch price
    expect(order.total).toBe(4500 + 2000); // subtotal + delivery fee

    let inv = await db.prisma.inventory.findUnique({
      where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    });
    expect(inv).toMatchObject({ qtyAvailable: 0, qtyReserved: 1 });

    const op = operator(s.operatorA, s.branchA);
    for (const next of ['confirmed', 'picking', 'packed', 'out_for_delivery', 'delivered'] as const) {
      await orders.transition(op, order.id, next);
    }
    inv = await db.prisma.inventory.findUnique({
      where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    });
    expect(inv).toMatchObject({ qtyAvailable: 0, qtyReserved: 0 }); // fulfilled

    const tracked = await orders.getForActor(customer(s.custAlice), order.id);
    expect(tracked.status).toBe('delivered');
    expect(tracked.events.map((e) => e.status)).toContain('delivered');
  });
});

describe('Phase 1 — price integrity (§11)', () => {
  it('ignores a tampered client price hint and charges the server price', async () => {
    const order = await checkoutMilk(randomUUID(), 1); // hint 1 piastre — must be ignored
    expect(order.items[0]?.unitPrice).toBe(4500);
    expect(order.total).toBe(6500);
  });
});

describe('Phase 1 — oversell during checkout (§11)', () => {
  it('two concurrent checkouts for the last unit → one order, one OUT_OF_STOCK', async () => {
    const results = await Promise.allSettled([checkoutMilk(), checkoutMilk()]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason?.message).toMatch(/OUT_OF_STOCK/);
    const count = await db.prisma.order.count();
    expect(count).toBe(1);
  });
});

describe('Phase 1 — idempotency (§11)', () => {
  it('double-submit with the same key → exactly one order, one reservation', async () => {
    const key = randomUUID();
    const [a, b] = await Promise.all([checkoutMilk(key), checkoutMilk(key)]);
    expect(a.id).toBe(b.id);
    expect(await db.prisma.order.count()).toBe(1);
    const inv = await db.prisma.inventory.findUnique({
      where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    });
    expect(inv?.qtyReserved).toBe(1); // not 2
  });
});

describe('Phase 1 — status machine (§11)', () => {
  it('rejects an illegal transition (placed → delivered)', async () => {
    const order = await checkoutMilk();
    await expect(
      orders.transition(operator(s.operatorA, s.branchA), order.id, 'delivered'),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });
  it('cancel releases reserved stock back to available', async () => {
    const order = await checkoutMilk();
    await orders.transition(operator(s.operatorA, s.branchA), order.id, 'cancelled');
    const inv = await db.prisma.inventory.findUnique({
      where: { productId_branchId: { productId: s.milk, branchId: s.branchA } },
    });
    expect(inv).toMatchObject({ qtyAvailable: 1, qtyReserved: 0 });
  });
});

describe('Phase 1 — negative authz (§11)', () => {
  it('a customer cannot read another customer\'s order (404, no leak)', async () => {
    const order = await checkoutMilk();
    await expect(orders.getForActor(customer(s.custBob), order.id)).rejects.toThrow();
  });
  it('an operator cannot read or transition another branch\'s order', async () => {
    const order = await checkoutMilk();
    const opB = operator(s.operatorB, s.branchB);
    await expect(orders.getForActor(opB, order.id)).rejects.toThrow();
    await expect(orders.transition(opB, order.id, 'confirmed')).rejects.toThrow();
  });
});

describe('Phase 1 — live status (§11) via realtime', () => {
  it('a transition publishes on channel-per-order (post-commit)', async () => {
    const order = await checkoutMilk();
    const listener = new Client({ connectionString: db.url });
    await listener.connect();
    const received = new Promise<{ status: string; version: number }>((resolve) => {
      listener.on('notification', (msg) => {
        if (msg.payload) resolve(JSON.parse(msg.payload));
      });
    });
    await listener.query(`LISTEN "${orderChannelName(order.id)}"`);
    await orders.transition(operator(s.operatorA, s.branchA), order.id, 'confirmed');
    const event = await received;
    expect(event).toMatchObject({ status: 'confirmed', version: 1 });
    await listener.end();
  });
});
