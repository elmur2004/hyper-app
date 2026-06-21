import { describe, it, expect } from 'vitest';
import { InventorySchema, ReservationResultSchema, ReservationRequestSchema } from './inventory';

const baseInventory = {
  id: '11111111-1111-1111-1111-111111111111',
  productId: '22222222-2222-2222-2222-222222222222',
  branchId: '33333333-3333-3333-3333-333333333333',
  qtyAvailable: 5,
  qtyReserved: 2,
  updatedAt: '2026-06-18T00:00:00.000Z',
};

describe('InventorySchema', () => {
  it('accepts a valid inventory row', () => {
    expect(InventorySchema.safeParse(baseInventory).success).toBe(true);
  });
  it('rejects negative qty (mirror of the DB CHECK constraint)', () => {
    expect(InventorySchema.safeParse({ ...baseInventory, qtyAvailable: -1 }).success).toBe(false);
    expect(InventorySchema.safeParse({ ...baseInventory, qtyReserved: -1 }).success).toBe(false);
  });
});

describe('ReservationRequestSchema', () => {
  it('requires a positive integer qty', () => {
    const ok = {
      branchId: baseInventory.branchId,
      productId: baseInventory.productId,
      qty: 1,
    };
    expect(ReservationRequestSchema.safeParse(ok).success).toBe(true);
    expect(ReservationRequestSchema.safeParse({ ...ok, qty: 0 }).success).toBe(false);
  });
});

describe('ReservationResultSchema (discriminated on ok)', () => {
  it('narrows the success branch', () => {
    const parsed = ReservationResultSchema.parse({ ok: true, qtyAvailable: 0, qtyReserved: 1 });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.qtyReserved).toBe(1);
  });
  it('narrows the typed error branch (OUT_OF_STOCK, not a 500)', () => {
    const parsed = ReservationResultSchema.parse({ ok: false, error: 'OUT_OF_STOCK' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toBe('OUT_OF_STOCK');
  });
  it('rejects an unknown error code', () => {
    expect(ReservationResultSchema.safeParse({ ok: false, error: 'NOPE' }).success).toBe(false);
  });
});
