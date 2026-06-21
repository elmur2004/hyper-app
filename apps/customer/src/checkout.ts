import type { CheckoutItemInput } from '@hyper/shared/client';
import { isTerminal, nextStates, type OrderStatus } from '@hyper/shared';
import type { CartLine } from './store/cart';

/** Build the server checkout payload from cart lines (server recomputes prices). */
export function toCheckoutItems(lines: CartLine[]): CheckoutItemInput[] {
  return lines.map((l) => ({ productId: l.productId, qty: l.qty }));
}

/** Arabic-first labels for order tracking (mirrors the dashboard StatusPill labels). */
export const STATUS_LABEL_AR: Record<OrderStatus, string> = {
  placed: 'تم الطلب',
  confirmed: 'مؤكد',
  picking: 'يتم التجهيز',
  packed: 'تم التعبئة',
  out_for_delivery: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
  refunded: 'تم الاسترجاع',
};

/** A customer may cancel only while the order is still cancellable (pre-delivery). */
export function customerCanCancel(status: OrderStatus): boolean {
  return !isTerminal(status) && nextStates(status).includes('cancelled');
}
