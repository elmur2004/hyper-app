import { describe, it, expect } from 'vitest';
import { OrderStatusSchema, type OrderStatus } from '../schemas/orders';
import {
  canTransition,
  assertTransition,
  applyTransition,
  nextStates,
  isTerminal,
  InvalidTransitionError,
} from './orderStatusMachine';

const ALL: OrderStatus[] = OrderStatusSchema.options;

const LEGAL = new Set<string>([
  'placed>confirmed',
  'placed>cancelled',
  'confirmed>picking',
  'confirmed>cancelled',
  'picking>packed',
  'picking>cancelled',
  'packed>out_for_delivery',
  'packed>cancelled',
  'out_for_delivery>delivered',
  'out_for_delivery>cancelled',
  'delivered>refunded',
]);

describe('order status machine — exhaustive (from,to) matrix', () => {
  it('accepts every legal edge and rejects every illegal edge', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const key = `${from}>${to}`;
        const legal = LEGAL.has(key);
        expect(canTransition(from, to)).toBe(legal);
        if (legal) {
          expect(applyTransition(from, to)).toBe(to);
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
        }
      }
    }
  });

  it('marks only cancelled and refunded as terminal', () => {
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('refunded')).toBe(true);
    for (const s of ['placed', 'confirmed', 'picking', 'packed', 'out_for_delivery', 'delivered'] as OrderStatus[]) {
      expect(isTerminal(s)).toBe(false);
    }
  });

  it('nextStates(delivered) === ["refunded"]', () => {
    expect([...nextStates('delivered')]).toEqual(['refunded']);
  });
});
