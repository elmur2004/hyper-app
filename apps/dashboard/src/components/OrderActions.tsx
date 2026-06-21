import { nextStates, type OrderStatus } from '@hyper/shared';
import { Button } from '@hyper/shared/ui';

const ACTION_LABEL_AR: Record<OrderStatus, string> = {
  placed: 'تم الطلب',
  confirmed: 'تأكيد',
  picking: 'تجهيز',
  packed: 'تعبئة',
  out_for_delivery: 'خروج للتوصيل',
  delivered: 'تم التوصيل',
  cancelled: 'إلغاء',
  refunded: 'استرجاع',
};

/**
 * Operator action buttons — renders ONLY the legal next transitions for the current status,
 * derived from the SHARED order status machine (so UI and server can't disagree).
 */
export function OrderActions({
  status,
  onTransition,
}: {
  status: OrderStatus;
  onTransition: (to: OrderStatus) => void;
}) {
  const next = nextStates(status);
  if (next.length === 0) return <span data-testid="no-actions">—</span>;
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {next.map((to) => (
        <Button
          key={to}
          size="sm"
          variant={to === 'cancelled' ? 'danger' : 'secondary'}
          onClick={() => onTransition(to)}
        >
          {ACTION_LABEL_AR[to]}
        </Button>
      ))}
    </div>
  );
}
