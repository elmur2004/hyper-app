// REFERENCE Expo Router screen — the cart + COD checkout golden path against the seeded data.
// Uses the SAME verified cart store, checkout view-model, and shared API client as the tests.
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radii, formatEgp } from '@hyper/shared';
import { api } from '../src/api';
import { cart } from '../src/store';
import { toCheckoutItems } from '../src/checkout';
import { Card, PrimaryButton, RoundButton, useCartLines } from '../components/ui';
import { ensureSession } from '../components/session';

interface AddressRow {
  id: string;
  isDefault: boolean;
}

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lines = useCartLines();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  async function checkout(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await ensureSession();

      const addresses = (await api.addresses.list()) as AddressRow[];
      const address = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (!address) throw new Error('لا يوجد عنوان للتوصيل');

      const order = await api.orders.checkout({
        addressId: address.id,
        items: toCheckoutItems(cart.getState().lines),
        paymentMethod: 'cod',
        idempotencyKey: `app-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      });
      cart.getState().clear();
      router.replace(`/track/${order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر إتمام الطلب');
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <Text style={{ fontSize: 56 }}>🛒</Text>
        <Text style={{ fontSize: 18, color: colors.ink, fontWeight: '700' }}>السلة فارغة</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>أضف بعض المنتجات لتبدأ طلبك.</Text>
        <PrimaryButton label="تصفّح المنتجات" color={colors.systemsIndigo} onPress={() => router.replace('/')} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={lines}
        keyExtractor={(l) => l.productId}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 200 }}
        renderItem={({ item }) => (
          <Card style={{ padding: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '600' }}>{item.nameAr}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{formatEgp(item.unitPrice)} / الوحدة</Text>
              </View>
              <Text style={{ color: colors.systemsIndigo, fontWeight: '800' }}>{formatEgp(item.unitPrice * item.qty)}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <RoundButton label="−" bg={colors.background} fg={colors.ink} onPress={() => cart.getState().setQty(item.productId, item.qty - 1)} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, minWidth: 20, textAlign: 'center' }}>{item.qty}</Text>
                <RoundButton label="+" onPress={() => cart.getState().setQty(item.productId, item.qty + 1)} />
              </View>
              <Pressable onPress={() => cart.getState().remove(item.productId)} hitSlop={8}>
                <Text style={{ color: colors.danger, fontSize: 13 }}>حذف</Text>
              </Pressable>
            </View>
          </Card>
        )}
        ListFooterComponent={
          <Card style={{ padding: spacing.lg, marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.muted }}>المجموع الفرعي</Text>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{formatEgp(subtotal)}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>الإجمالي</Text>
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>{formatEgp(subtotal)}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: spacing.sm }}>
              السعر النهائي ورسوم التوصيل تُحسب على الخادم عند تأكيد الطلب.
            </Text>
          </Card>
        }
      />

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: spacing.lg,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderColor: colors.border,
          gap: spacing.sm,
        }}
      >
        {error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>}
        <PrimaryButton label={`الدفع عند الاستلام · ${formatEgp(subtotal)}`} loading={busy} onPress={checkout} />
      </View>
    </View>
  );
}
