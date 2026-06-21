import type { OrderStatus } from '../schemas/orders';

/**
 * Legal order-status transitions (Plan §4):
 *   placed → confirmed → picking → packed → out_for_delivery → delivered
 * with side-branches `cancelled` (pre-delivery) and `refunded` (post-delivery).
 *
 * This is a PURE, I/O-free shared guard. The authoritative transition still executes
 * server-side inside the stock/transaction path; the dashboard uses `nextStates` to
 * render only legal action buttons.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['picking', 'cancelled'],
  picking: ['packed', 'cancelled'],
  packed: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Illegal order status transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export const nextStates = (from: OrderStatus): readonly OrderStatus[] => TRANSITIONS[from];

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const isTerminal = (status: OrderStatus): boolean => TRANSITIONS[status].length === 0;

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Pure reducer: returns the new status if legal, else throws. No side effects. */
export function applyTransition(from: OrderStatus, to: OrderStatus): OrderStatus {
  assertTransition(from, to);
  return to;
}
