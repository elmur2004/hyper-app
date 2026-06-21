import type { OrderStatus } from '../schemas/orders';
import { statusColors } from '../theme/tokens';
import { radii } from '../theme/tokens';

/** Arabic-first labels per order status (Plan: Arabic-first / RTL). */
const STATUS_LABEL_AR: Record<OrderStatus, string> = {
  placed: 'تم الطلب',
  confirmed: 'مؤكد',
  picking: 'يتم التجهيز',
  packed: 'تم التعبئة',
  out_for_delivery: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
  refunded: 'تم الاسترجاع',
};

export interface StatusPillProps {
  status: OrderStatus;
}

/** Exhaustive over OrderStatus (Record typing fails the build if a status is unmapped). */
export function StatusPill({ status }: StatusPillProps) {
  const color = statusColors[status];
  return (
    <span
      data-testid="status-pill"
      data-status={status}
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: radii.pill,
        background: `${color}22`,
        color,
        border: `1px solid ${color}`,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {STATUS_LABEL_AR[status]}
    </span>
  );
}
