import { describe, it, expect } from 'vitest';
import {
  OrderSchema,
  type Order,
  type BranchId,
  type CustomerId,
  type AddressId,
  type OrderId,
} from './schemas';

/**
 * Cross-surface contract guard (T0.2.6): a representative Order graph must round-trip
 * losslessly through JSON and re-validate against the shared schema — this is the wire
 * contract the customer app reads and the dashboard firehose consumes. `packages/shared`
 * is the single source of truth; no surface redefines these shapes.
 */
describe('shared contract round-trip', () => {
  const order: Order = {
    id: '44444444-4444-4444-4444-444444444444' as OrderId,
    customerId: '11111111-1111-1111-1111-111111111111' as CustomerId,
    branchId: '33333333-3333-3333-3333-333333333333' as BranchId,
    addressId: '55555555-5555-5555-5555-555555555555' as AddressId,
    status: 'placed',
    subtotal: 150050,
    deliveryFee: 2000,
    discount: 0,
    total: 152050,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    slotStart: null,
    slotEnd: null,
    placedAt: '2026-06-18T00:00:00.000Z',
    version: 0,
  };

  it('serializes and re-parses an Order with no lossy coercion (money/timestamps/ids)', () => {
    const wire = JSON.parse(JSON.stringify(order));
    const parsed = OrderSchema.parse(wire);
    expect(parsed).toEqual(order);
    expect(Number.isInteger(parsed.total)).toBe(true); // money stays integer piastres
  });

  it('rejects a tampered (float) money value at the boundary', () => {
    const tampered = { ...order, total: 1520.5 };
    expect(OrderSchema.safeParse(tampered).success).toBe(false);
  });
});
