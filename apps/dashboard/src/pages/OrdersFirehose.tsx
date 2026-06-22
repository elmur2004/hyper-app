import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { formatEgp, type OrderStatus } from '@hyper/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '../api';
import { useAuth } from '../auth';
import { OrderActions } from '../components/OrderActions';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'pink' | 'outline';

const STATUS: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  placed: { label: 'تم الطلب', variant: 'secondary' },
  confirmed: { label: 'مؤكد', variant: 'default' },
  picking: { label: 'يتم التجهيز', variant: 'warning' },
  packed: { label: 'تم التعبئة', variant: 'warning' },
  out_for_delivery: { label: 'في الطريق', variant: 'pink' },
  delivered: { label: 'تم التوصيل', variant: 'success' },
  cancelled: { label: 'ملغي', variant: 'destructive' },
  refunded: { label: 'تم الاسترجاع', variant: 'outline' },
};

/**
 * Central Command all-orders firehose / branch queue. Operators drive the status machine
 * inline; realtime is an optimization over REST (Plan §5) — we refetch authoritative state
 * after each transition and on focus.
 */
export function OrdersFirehosePage() {
  const { actor } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['orders', 'queue'],
    queryFn: () => api.orders.branchQueue(),
    refetchOnWindowFocus: true,
  });

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: OrderStatus }) => api.orders.transition(id, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', 'queue'] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الطلبات</h1>
          <p className="text-sm text-muted-foreground">
            {actor?.role === 'hq_admin' ? 'كل الفروع' : 'فرعك'} · {data?.length ?? 0} طلب
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ['orders', 'queue'] })}
          disabled={isFetching}
        >
          <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          تحديث
        </Button>
      </div>

      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
            </div>
          )}
          {isError && <p className="p-10 text-center text-destructive">تعذر تحميل الطلبات</p>}
          {data && data.length === 0 && (
            <p data-testid="orders-empty" className="p-10 text-center text-muted-foreground">
              لا توجد طلبات حالياً
            </p>
          )}
          {data && data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>الطلب</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead className="text-end">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((o) => (
                  <TableRow key={o.id} data-testid="order-row">
                    <TableCell className="font-mono text-xs text-muted-foreground">#{o.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS[o.status].variant}>{STATUS[o.status].label}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{formatEgp(o.total)}</TableCell>
                    <TableCell className="text-end">
                      <OrderActions status={o.status} onTransition={(to) => transition.mutate({ id: o.id, to })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
