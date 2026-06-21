import { StatusPill, Price } from '@hyper/shared/ui';
import type { OrderWithItems } from '@hyper/shared/client';

/** Presentational orders grid (used by the Central Command firehose + branch queue). */
export function OrdersTable({ orders }: { orders: OrderWithItems[] }) {
  if (orders.length === 0) {
    return <p data-testid="orders-empty">لا توجد طلبات</p>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
      <thead>
        <tr>
          <th>الطلب</th>
          <th>الفرع</th>
          <th>الحالة</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} data-testid="order-row">
            <td style={{ fontFamily: 'JetBrains Mono' }}>{o.id.slice(0, 8)}</td>
            <td>{o.branchId.slice(0, 8)}</td>
            <td>
              <StatusPill status={o.status} />
            </td>
            <td>
              <Price piastres={o.total} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
