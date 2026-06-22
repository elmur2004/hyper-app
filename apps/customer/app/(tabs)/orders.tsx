// REFERENCE Expo Router screen — order history (طلباتي tab). Authenticates the demo customer
// then lists their orders via the shared API client.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { colors, spacing, formatEgp, type OrderStatus } from '@hyper/shared';
import type { OrderWithItems } from '@hyper/shared/client';
import { api } from '../../src/api';
import { STATUS_LABEL_AR } from '../../src/checkout';
import { Card, PrimaryButton } from '../../components/ui';
import { ensureSession } from '../../components/session';

const STATUS_COLOR: Record<OrderStatus, string> = {
  placed: colors.muted,
  confirmed: colors.systemsIndigo,
  picking: colors.warning,
  packed: colors.warning,
  out_for_delivery: colors.signalPink,
  delivered: colors.success,
  cancelled: colors.danger,
  refunded: colors.muted,
};

export default function OrdersScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [orders, setOrders] = useState<OrderWithItems[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      await ensureSession();
      const list = await api.orders.list();
      // Newest first (ISO timestamps sort lexically).
      setOrders([...list].sort((a, b) => b.placedAt.localeCompare(a.placedAt)));
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (orders === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <ActivityIndicator color={colors.systemsIndigo} />
        <Text style={{ color: colors.muted }}>جارٍ تحميل طلباتك…</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <Text style={{ fontSize: 56 }}>🧾</Text>
        <Text style={{ fontSize: 18, color: colors.ink, fontWeight: '700' }}>لا توجد طلبات سابقة</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>عند إتمام أول طلب سيظهر هنا.</Text>
        <PrimaryButton label="تصفّح المنتجات" color={colors.systemsIndigo} onPress={() => router.replace('/')} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      data={orders}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: tabBarHeight + spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.systemsIndigo} />}
      renderItem={({ item }) => {
        const itemCount = item.items.reduce((n, it) => n + it.qty, 0);
        return (
          <Pressable onPress={() => router.push(`/track/${item.id}`)}>
            <Card style={{ padding: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.ink, fontWeight: '700', fontFamily: 'monospace' }}>#{item.id.slice(0, 8)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLOR[item.status] }} />
                  <Text style={{ color: STATUS_COLOR[item.status], fontWeight: '600', fontSize: 13 }}>{STATUS_LABEL_AR[item.status]}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {item.placedAt.slice(0, 10)} · {itemCount} منتج
                </Text>
                <Text style={{ color: colors.systemsIndigo, fontWeight: '800', fontSize: 16 }}>{formatEgp(item.total)}</Text>
              </View>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}
