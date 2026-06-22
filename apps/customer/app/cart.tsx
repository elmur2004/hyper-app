// REFERENCE Expo Router screen — the cart + COD checkout golden path against the seeded data.
// Uses the SAME verified cart store, checkout view-model, and shared API client as the tests.
import { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, formatEgp } from '@hyper/shared';
import { api, setToken } from '../src/api';
import { cart } from '../src/store';
import { toCheckoutItems } from '../src/checkout';

// Demo customer seeded by `pnpm --filter @hyper/api seed` (has a default in-zone address).
const DEMO_PHONE = '+201000000001';

interface AddressRow {
  id: string;
  isDefault: boolean;
}

export default function CartScreen() {
  const router = useRouter();
  const [lines, setLines] = useState(cart.getState().lines);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep local state in sync with the vanilla store.
  cart.subscribe((s) => setLines(s.lines));

  const subtotal = cart.getState().subtotal();

  async function checkout(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      // Dev OTP login (the API returns the code as devCode in non-prod).
      const { devCode } = await api.auth.requestOtp(DEMO_PHONE);
      const { token } = await api.auth.verifyOtp(DEMO_PHONE, devCode ?? '');
      setToken(token);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <FlatList
        data={lines}
        keyExtractor={(l) => l.productId}
        ListEmptyComponent={<Text style={{ color: colors.muted }}>السلة فارغة</Text>}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
            <Text style={{ color: colors.ink }}>
              {item.nameAr} × {item.qty}
            </Text>
            <Text style={{ color: colors.muted }}>{formatEgp(item.unitPrice * item.qty)}</Text>
          </View>
        )}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md }}>
        <Text style={{ color: colors.ink, fontSize: 18 }}>الإجمالي</Text>
        <Text style={{ color: colors.ink, fontSize: 18 }}>{formatEgp(subtotal)}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: spacing.md }}>
        السعر النهائي يُحسب على الخادم عند تأكيد الطلب.
      </Text>

      {error && <Text style={{ color: colors.signalPink, marginBottom: spacing.sm }}>{error}</Text>}

      <Pressable
        disabled={busy || lines.length === 0}
        onPress={checkout}
        style={{
          backgroundColor: lines.length === 0 ? colors.border : colors.signalPink,
          padding: spacing.md,
          borderRadius: 10,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', textAlign: 'center' }}>الدفع عند الاستلام</Text>
        )}
      </Pressable>
    </View>
  );
}
