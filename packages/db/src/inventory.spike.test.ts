import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { BranchId, ProductId, ReservationRequest, ReservationResult } from '@hyper/shared';
import { startTestDb, type TestDb } from './harness';
import {
  INVENTORY_DDL,
  placeReservation,
  cancelReservation,
  fulfillReservation,
} from './inventory';

// Branded ids are constructed by casting at this boundary (literal UUID → branded id).
const BRANCH = '33333333-3333-3333-3333-333333333333' as BranchId;
const PRODUCT = '22222222-2222-2222-2222-222222222222' as ProductId;
const req = (qty: number): ReservationRequest => ({ branchId: BRANCH, productId: PRODUCT, qty });

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb({ port: 54330, maxConnections: 40 });
  await db.pool.query(INVENTORY_DDL);
});

afterAll(async () => {
  await db?.stop();
});

/** Reset to a single unit of stock before each test. */
async function seedOne(): Promise<void> {
  await db.pool.query('TRUNCATE inventory');
  await db.pool.query(
    'INSERT INTO inventory (product_id, branch_id, qty_available, qty_reserved) VALUES ($1, $2, 1, 0)',
    [PRODUCT, BRANCH],
  );
}

async function currentQty(): Promise<{ available: number; reserved: number }> {
  const r = await db.pool.query<{ qty_available: number; qty_reserved: number }>(
    'SELECT qty_available, qty_reserved FROM inventory WHERE branch_id = $1 AND product_id = $2',
    [BRANCH, PRODUCT],
  );
  return { available: r.rows[0]!.qty_available, reserved: r.rows[0]!.qty_reserved };
}

beforeEach(seedOne);

describe('S1 — reservation lifecycle (single caller)', () => {
  it('place succeeds, then cleanly reports OUT_OF_STOCK when depleted', async () => {
    const first = await placeReservation(db.pool, req(1));
    expect(first).toEqual({ ok: true, qtyAvailable: 0, qtyReserved: 1 });

    const second = await placeReservation(db.pool, req(1));
    expect(second).toEqual({ ok: false, error: 'OUT_OF_STOCK' });

    expect(await currentQty()).toEqual({ available: 0, reserved: 1 });
  });

  it('cancel restores the unit (reserved → available)', async () => {
    await placeReservation(db.pool, req(1));
    const cancelled = await cancelReservation(db.pool, req(1));
    expect(cancelled).toEqual({ ok: true, qtyAvailable: 1, qtyReserved: 0 });
    expect(await currentQty()).toEqual({ available: 1, reserved: 0 });
  });

  it('fulfill consumes the unit (reserved → gone)', async () => {
    await placeReservation(db.pool, req(1));
    const fulfilled = await fulfillReservation(db.pool, req(1));
    expect(fulfilled).toEqual({ ok: true, qtyAvailable: 0, qtyReserved: 0 });
    expect(await currentQty()).toEqual({ available: 0, reserved: 0 });
  });

  it('returns NOT_FOUND for an unknown SKU and rejects non-positive qty', async () => {
    const missing = await placeReservation(db.pool, {
      branchId: BRANCH,
      productId: '00000000-0000-0000-0000-000000000000' as ProductId,
      qty: 1,
    });
    expect(missing).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await placeReservation(db.pool, req(0))).toEqual({ ok: false, error: 'INVALID_QTY' });
  });
});

describe('S1 — THE oversell gate: N concurrent orders for stock=1', () => {
  async function fireConcurrent(n: number): Promise<ReservationResult[]> {
    await seedOne();
    return Promise.all(Array.from({ length: n }, () => placeReservation(db.pool, req(1))));
  }

  for (const n of [20, 100, 1000]) {
    it(`${n} concurrent place-orders → exactly 1 success, ${n - 1} clean OUT_OF_STOCK, qty never negative`, async () => {
      const results = await fireConcurrent(n);
      const successes = results.filter((r) => r.ok);
      const outOfStock = results.filter((r) => !r.ok && r.error === 'OUT_OF_STOCK');

      expect(successes).toHaveLength(1);
      expect(outOfStock).toHaveLength(n - 1);
      // no unexpected errors (no 500/deadlock surfaced as NOT_FOUND/INVALID_QTY)
      expect(results.every((r) => r.ok || r.error === 'OUT_OF_STOCK')).toBe(true);
      expect(await currentQty()).toEqual({ available: 0, reserved: 1 });
    });
  }

  it('is not flaky: 50 repeated rounds of 20 concurrent each yield exactly one winner', async () => {
    for (let round = 0; round < 50; round++) {
      const results = await fireConcurrent(20);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const q = await currentQty();
      expect(q.available).toBe(0);
      expect(q.available).toBeGreaterThanOrEqual(0); // invariant never violated
    }
  });
});
