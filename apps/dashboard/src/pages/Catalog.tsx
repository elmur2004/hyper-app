import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImageOff, Loader2 } from 'lucide-react';
import { formatEgp } from '@hyper/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '../api';

/** HQ/branch catalog view (read of the customer-facing surface for a branch). */
export function CatalogPage() {
  const [branchId, setBranchId] = useState('');

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.admin.listBranches() });

  useEffect(() => {
    const first = branches.data?.[0];
    if (!branchId && first) setBranchId(first.id);
  }, [branchId, branches.data]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog', branchId],
    queryFn: () => api.catalog(branchId),
    enabled: branchId.length > 0,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الكتالوج</h1>
          <p className="text-sm text-muted-foreground">عرض المنتجات المتاحة للعملاء في كل فرع</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label>الفرع</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="اختر الفرع" />
            </SelectTrigger>
            <SelectContent>
              {branches.data?.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                  {b.isActive ? '' : ' (غير نشط)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ تحميل المنتجات…
        </div>
      )}
      {isError && <p className="text-destructive">تعذر تحميل الكتالوج</p>}
      {data && data.length === 0 && <p className="text-muted-foreground">لا توجد منتجات في هذا الفرع</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(data ?? []).map((row) => (
          <Card key={row.productId} className="overflow-hidden py-0">
            <div className="aspect-square w-full bg-muted">
              {row.imageUrls[0] ? (
                <img src={row.imageUrls[0]} alt={row.nameAr} className="size-full object-cover" loading="lazy" />
              ) : (
                <div className="grid size-full place-items-center text-muted-foreground">
                  <ImageOff className="size-8" />
                </div>
              )}
            </div>
            <CardContent className="flex flex-col gap-1.5 p-3">
              <p className="line-clamp-2 text-sm font-medium leading-snug">{row.nameAr}</p>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">{formatEgp(row.price)}</span>
                <Badge variant={row.inStock ? 'success' : 'outline'}>{row.inStock ? 'متوفر' : 'غير متوفر'}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
