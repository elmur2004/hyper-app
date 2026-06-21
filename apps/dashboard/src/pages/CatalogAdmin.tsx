import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card } from '@hyper/shared/ui';
import { api } from '../api';

/**
 * Central Command master-catalog writes (HQ-admin). Create a product, set stock, set price —
 * the server enforces RBAC (only HQ-admin) and writes audit_log. Master catalog is the single
 * source of truth; nothing reaches the customer app that isn't created here.
 */
export function CatalogAdminPage() {
  const [form, setForm] = useState({ sku: '', nameAr: '', nameEn: '', categoryId: '', basePrice: '', unit: 'ea' });
  const [msg, setMsg] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.admin.createProduct({
        sku: form.sku,
        nameAr: form.nameAr,
        nameEn: form.nameEn,
        categoryId: form.categoryId,
        basePrice: Number(form.basePrice),
        unit: form.unit,
      }),
    onSuccess: () => setMsg('تم إنشاء المنتج'),
    onError: () => setMsg('فشل (تحقق من الصلاحية)'),
  });

  const field = (key: keyof typeof form, label: string) => (
    <label style={{ display: 'block', marginBottom: 8 }}>
      {label}
      <input
        aria-label={key}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        style={{ width: '100%', padding: 8 }}
      />
    </label>
  );

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h1>إدارة الكتالوج</h1>
      <Card header="منتج جديد">
        {field('sku', 'SKU')}
        {field('nameAr', 'الاسم (عربي)')}
        {field('nameEn', 'الاسم (إنجليزي)')}
        {field('categoryId', 'معرّف التصنيف')}
        {field('basePrice', 'السعر (بالقروش)')}
        {msg && <p>{msg}</p>}
        <Button onClick={() => create.mutate()} loading={create.isPending}>
          إنشاء
        </Button>
      </Card>
    </div>
  );
}
