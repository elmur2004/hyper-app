import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../src/prisma/prisma.service';
import { startApiTestDb, type ApiTestDb } from './harness';
import { seed, type SeedResult } from './seed';
import { PaymentsService } from '../src/modules/payments/payments.service';

let db: ApiTestDb;
let s: SeedResult;
let payments: PaymentsService;

beforeAll(async () => {
  db = await startApiTestDb(54344);
  s = await seed(db.prisma);
  payments = new PaymentsService(db.prisma as unknown as PrismaService);
});
afterAll(async () => {
  await db?.stop();
});

let orderId: string;
beforeEach(async () => {
  await db.prisma.$executeRawUnsafe('TRUNCATE order_items, idempotency_keys, orders CASCADE');
  const order = await db.prisma.order.create({
    data: {
      customerId: s.custAlice,
      branchId: s.branchA,
      addressId: s.addrAliceInA,
      subtotal: 4500,
      deliveryFee: 2000,
      total: 6500,
      paymentMethod: 'online',
    },
  });
  orderId = order.id;
});

describe('Phase 4 — payments', () => {
  it('COD orders get no online intent', async () => {
    const cod = await db.prisma.order.create({
      data: {
        customerId: s.custAlice,
        branchId: s.branchA,
        addressId: s.addrAliceInA,
        subtotal: 1000,
        deliveryFee: 2000,
        total: 3000,
        paymentMethod: 'cod',
      },
    });
    const intent = await payments.createIntentForOrder(cod.id);
    expect(intent.online).toBe(false);
    expect(intent.provider).toBe('cod');
  });

  it('rejects a webhook with a bad signature (never sets paid from an unsigned client)', async () => {
    const body = JSON.stringify({ orderId, status: 'paid', providerRef: randomUUID() });
    await expect(payments.handleWebhook(body, 'not-a-valid-signature')).rejects.toThrow();
    const order = await db.prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.paymentStatus).toBe('pending');
  });

  it('a correctly-signed webhook marks the order paid (server-side only)', async () => {
    const body = JSON.stringify({ orderId, status: 'paid', providerRef: randomUUID() });
    const sig = payments.signPaymob(body);
    const res = await payments.handleWebhook(body, sig);
    expect(res.processed).toBe(true);
    const order = await db.prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.paymentStatus).toBe('paid');
  });

  it('is idempotent: replaying the same webhook is a no-op', async () => {
    const body = JSON.stringify({ orderId, status: 'paid', providerRef: 'fixed-ref-123' });
    const sig = payments.signPaymob(body);
    const first = await payments.handleWebhook(body, sig);
    const second = await payments.handleWebhook(body, sig);
    expect(first.processed).toBe(true);
    expect(second.processed).toBe(false); // de-duped
  });
});
