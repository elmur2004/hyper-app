import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Price } from '@hyper/shared/ui';
import { api } from '../api';

/** HQ/branch catalog view (read of the customer-facing surface for a branch). */
export function CatalogPage() {
  const [branchId, setBranchId] = useState('');
  const { data } = useQuery({
    queryKey: ['catalog', branchId],
    queryFn: () => api.catalog(branchId),
    enabled: branchId.length > 0,
  });

  return (
    <div style={{ padding: 24 }}>
      <h1>الكتالوج</h1>
      <input
        placeholder="معرّف الفرع"
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        aria-label="branchId"
        style={{ padding: 8, marginBottom: 16 }}
      />
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
