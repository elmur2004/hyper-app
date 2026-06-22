import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Price } from '@hyper/shared/ui';
import { api } from '../api';

/** HQ/branch catalog view (read of the customer-facing surface for a branch). */
export function CatalogPage() {
  const [branchId, setBranchId] = useState('');

  const branches = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.admin.listBranches(),
  });

  // Default to the first branch once the list loads.
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
    <div style={{ padding: 24 }}>
      <h1>الكتالوج</h1>
      <select
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        aria-label="branch"
        style={{ padding: 8, marginBottom: 16, minWidth: 240 }}
      >
        {branches.isLoading && <option>...جارٍ تحميل الفروع</option>}
        {branches.data?.length === 0 && <option>لا توجد فروع</option>}
        {branches.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.isActive ? '' : ' (غير نشط)'}
          </option>
        ))}
      </select>

      {isLoading && <p>...جارٍ تحميل المنتجات</p>}
      {isError && <p style={{ color: '#D11149' }}>تعذر تحميل الكتالوج</p>}
      {data && data.length === 0 && <p>لا توجد منتجات في هذا الفرع</p>}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
        {(data ?? []).map((row) => (
          <Card key={row.productId} header={row.nameAr}>
            <Price piastres={row.price} />
            <p>{row.inStock ? 'متوفر' : 'غير متوفر'}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
