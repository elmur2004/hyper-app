import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ImageOff, Loader2, Plus } from 'lucide-react';
import { formatEgp } from '@hyper/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '../api';

/** Inline editor for one product's stock at one branch (server enforces RBAC + audit). */
function StockCell({ productId, branchId, current }: { productId: string; branchId: string; current: number }) {
  const qc = useQueryClient();
  const [val, setVal] = useState(String(current));
  useEffect(() => setVal(String(current)), [current]); // resync after refetch

  const save = useMutation({
    mutationFn: () => api.admin.setStock(branchId, productId, Number(val)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'products'] }),
  });

  const dirty = val.trim() !== '' && Number(val) !== current && !Number.isNaN(Number(val));

  return (
    <div className="flex items-center gap-1">
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        inputMode="numeric"
        className="h-8 w-16 text-center"
        aria-label={`stock-${branchId}`}
      />
      <Button
        size="icon"
        variant={dirty ? 'cta' : 'ghost'}
        disabled={!dirty || save.isPending}
        onClick={() => save.mutate()}
        className="size-8"
        aria-label="save-stock"
      >
        {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      </Button>
    </div>
  );
}

/**
 * Central Command master catalog (HQ-admin). Create products, and edit per-branch stock inline.
 * The server enforces RBAC (only HQ-admin) and writes audit_log on every mutation.
 */
export function CatalogAdminPage() {
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ['admin', 'products'], queryFn: () => api.admin.listProducts() });
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.admin.listBranches() });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.admin.listCategories() });

  const [form, setForm] = useState({ sku: '', nameAr: '', nameEn: '', categoryId: '', basePrice: '', unit: 'ea' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const first = categories.data?.[0];
    if (!form.categoryId && first) setForm((f) => ({ ...f, categoryId: first.id }));
  }, [form.categoryId, categories.data]);

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
    onSuccess: () => {
      setMsg({ ok: true, text: 'تم إنشاء المنتج' });
      setForm((f) => ({ ...f, sku: '', nameAr: '', nameEn: '', basePrice: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
    onError: () => setMsg({ ok: false, text: 'فشل الإنشاء (تحقق من الصلاحية والحقول)' }),
  });

  const field = (key: 'sku' | 'nameAr' | 'nameEn' | 'basePrice', label: string, props?: { dir?: 'ltr' }) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        aria-label={key}
        value={form[key]}
        dir={props?.dir}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  const branchList = branches.data ?? [];
  const qtyFor = (inv: { branchId: string; qtyAvailable: number }[], branchId: string) =>
    inv.find((i) => i.branchId === branchId)?.qtyAvailable ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">إدارة الكتالوج</h1>
        <p className="text-sm text-muted-foreground">الكتالوج الرئيسي ومخزون كل فرع</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>منتج جديد</CardTitle>
          <CardDescription>يُضاف للكتالوج الرئيسي. لإظهاره للعملاء يحتاج تسعير وإدراج ومخزون في الفرع.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            {field('sku', 'SKU', { dir: 'ltr' })}
            {field('nameAr', 'الاسم (عربي)')}
            {field('nameEn', 'الاسم (إنجليزي)', { dir: 'ltr' })}
            <div className="flex flex-col gap-2">
              <Label>التصنيف</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger aria-label="categoryId">
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  {categories.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field('basePrice', 'السعر الأساسي (بالقروش)', { dir: 'ltr' })}
            <div className="flex items-end gap-3 sm:col-span-2">
              <Button type="submit" variant="cta" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                إنشاء المنتج
              </Button>
              {msg && <p className={msg.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{msg.text}</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden pb-0">
        <CardHeader>
          <CardTitle>المنتجات والمخزون</CardTitle>
          <CardDescription>عدّل الكمية المتاحة لكل فرع ثم اضغط ✓ للحفظ.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {products.isLoading && (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
            </div>
          )}
          {products.data && products.data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>المنتج</TableHead>
                  <TableHead>السعر الأساسي</TableHead>
                  <TableHead>الحالة</TableHead>
                  {branchList.map((b) => (
                    <TableHead key={b.id}>مخزون {b.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                          {p.imageUrls[0] ? (
                            <img src={p.imageUrls[0]} alt={p.nameAr} className="size-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid size-full place-items-center text-muted-foreground">
                              <ImageOff className="size-4" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{p.nameAr}</span>
                          <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatEgp(p.basePrice)}</TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? 'success' : 'outline'}>{p.isActive ? 'نشط' : 'متوقف'}</Badge>
                    </TableCell>
                    {branchList.map((b) => (
                      <TableCell key={b.id}>
                        <StockCell productId={p.id} branchId={b.id} current={qtyFor(p.inventory, b.id)} />
                      </TableCell>
                    ))}
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
