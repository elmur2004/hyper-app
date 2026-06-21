import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderStatus } from '@hyper/shared';
import { StatusPill, Price } from '@hyper/shared/ui';
import { api } from '../api';
import { useAuth } from '../auth';
import { OrderActions } from '../components/OrderActions';

/**
 * Central Command all-orders firehose / branch queue. Operators drive the status machine
 * inline; realtime is an optimization over REST (Plan §5) — we refetch authoritative state
 * after each transition and on focus.
 */
export function OrdersFirehosePage() {
  const { actor, logout } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['orders', 'queue'],
    queryFn: () => api.orders.branchQueue(),
    refetchOnWindowFocus: true,
  });

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: OrderStatus }) => api.orders.transition(id, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', 'queue'] }),
  });

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>الطلبات {actor?.role === 'hq_admin' ? '(كل الفروع)' : '(فرعك)'}</h1>
        <button onClick={logout}>خروج</button>
      </header>
      {isLoading && <p>...جارٍ التحميل</p>}
      {isError && <p style={{ color: '#D11149' }}>تعذر تحميل الطلبات</p>}
      {data && data.length === 0 && <p data-testid="orders-empty">لا توجد طلبات</p>}
      {data && data.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
          <thead>
            <tr>
              <th>الطلب</th>
              <th>الحالة</th>
              <th>الإجمالي</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {data.map((o) => (
              <tr key={o.id} data-testid="order-row">
                <td style={{ fontFamily: 'JetBrains Mono' }}>{o.id.slice(0, 8)}</td>
                <td>
                  <StatusPill status={o.status} />
                </td>
                <td>
                  <Price piastres={o.total} />
                </td>
                <td>
                  <OrderActions status={o.status} onTransition={(to) => transition.mutate({ id: o.id, to })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
