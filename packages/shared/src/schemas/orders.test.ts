import { describe, it, expect } from 'vitest';
import {
  OrderStatusSchema,
  OrderStatusEventSchema,
  orderChannelName,
  parseOrderChannel,
  branchChannelName,
  parseBranchChannel,
} from './orders';

describe('OrderStatusSchema', () => {
  it('covers the full lifecycle + side-branches', () => {
    for (const s of [
      'placed',
      'confirmed',
      'picking',
      'packed',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'refunded',
    ]) {
      expect(OrderStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(OrderStatusSchema.safeParse('shipped').success).toBe(false);
  });
});

describe('channel helpers (channel-per-order / per-branch)', () => {
  it('round-trips an order channel', () => {
    const id = '44444444-4444-4444-4444-444444444444';
    expect(parseOrderChannel(orderChannelName(id))).toBe(id);
    expect(parseOrderChannel('not-an-order-channel')).toBeNull();
  });
  it('round-trips a branch channel', () => {
    const id = '55555555-5555-5555-5555-555555555555';
    expect(parseBranchChannel(branchChannelName(id))).toBe(id);
    expect(parseBranchChannel(orderChannelName(id))).toBeNull();
  });
});

describe('OrderStatusEventSchema', () => {
  const event = {
    orderId: '44444444-4444-4444-4444-444444444444',
    status: 'confirmed',
    version: 1,
    branchId: '33333333-3333-3333-3333-333333333333',
    occurredAt: '2026-06-18T00:00:00.000Z',
  };
  it('parses a valid event', () => {
    expect(OrderStatusEventSchema.safeParse(event).success).toBe(true);
  });
  it('rejects a missing version or bad status', () => {
    const { version: _omit, ...noVersion } = event;
    void _omit;
    expect(OrderStatusEventSchema.safeParse(noVersion).success).toBe(false);
    expect(OrderStatusEventSchema.safeParse({ ...event, status: 'nope' }).success).toBe(false);
  });
});
