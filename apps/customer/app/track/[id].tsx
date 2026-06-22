// REFERENCE Expo Router screen (order tracking) — see README. Realtime is an optimization
// over REST: this refetches authoritative state (and would subscribe to the order channel).
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, spacing, radii, formatEgp, type OrderStatus } from '@hyper/shared';
import { api } from '../../src/api';
import type { OrderWithItems } from '@hyper/shared/client';
import { Card } from '../../components/ui';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'placed', label: 'تم استلام الطلب' },
  { status: 'confirmed', label: 'تم التأكيد' },
  { status: 'picking', label: 'يتم التجهيز' },
  { status: 'packed', label: 'تم التعبئة' },
  { status: 'out_for_delivery', label: 'في الطريق إليك' },
  { status: 'delivered', label: 'تم التوصيل' },
];

const TERMINAL: OrderStatus[] = ['delivered', 'cancelled', 'refunded'];

export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithItems | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = (): void => {
      api.orders
        .get(id)
        .then((o) => active && setOrder(o))
        .catch(() => active && setOrder(null));
    };
    load();
    // Poll for live status until the order reaches a terminal state.
    const t = setInterval(() => {
      if (order && TERMINAL.includes(order.status)) return;
      load();
    }, 7000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [id, order?.status]);

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <ActivityIndicator color={colors.systemsIndigo} />
        <Text style={{ color: colors.muted }}>جارٍ تحميل حالة الطلب…</Text>
      </View>
    );
  }

  const cancelled = order.status === 'cancelled' || order.status === 'refunded';
  const currentIndex = STEPS.findIndex((s) => s.status === order.status);
  const itemCount = order.items.reduce((n, it) => n + it.qty, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Card style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>رقم الطلب</Text>
        <Text style={{ color: colors.ink, fontWeight: '700', fontFamily: 'monospace' }}>#{order.id.slice(0, 8)}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
          <Text style={{ color: colors.muted }}>{itemCount} منتج · الدفع عند الاستلام</Text>
          <Text style={{ color: colors.systemsIndigo, fontWeight: '800', fontSize: 16 }}>{formatEgp(order.total)}</Text>
        </View>
      </Card>

      {cancelled ? (
        <Card style={{ padding: spacing.lg, borderColor: colors.danger }}>
          <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 16 }}>
            {order.status === 'refunded' ? 'تم استرجاع الطلب' : 'تم إلغاء الطلب'}
          </Text>
        </Card>
      ) : (
        <Card style={{ padding: spacing.lg }}>
          {STEPS.map((step, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            const dot = active ? colors.signalPink : done ? colors.systemsIndigo : colors.border;
            return (
              <View key={step.status} style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: done || active ? dot : colors.surface,
                      borderWidth: 2,
                      borderColor: dot,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                  </View>
                  {i < STEPS.length - 1 && (
                    <View style={{ width: 2, flex: 1, minHeight: 28, backgroundColor: done ? colors.systemsIndigo : colors.border }} />
                  )}
                </View>
                <View style={{ paddingBottom: spacing.lg, flex: 1 }}>
                  <Text
                    style={{
                      color: active ? colors.ink : done ? colors.ink : colors.muted,
                      fontWeight: active ? '800' : '600',
                      fontSize: 15,
                    }}
                  >
                    {step.label}
                  </Text>
                  {active && <Text style={{ color: colors.signalPink, fontSize: 12, marginTop: 2 }}>الحالة الحالية</Text>}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>يتم تحديث الحالة تلقائياً</Text>
      </View>
    </ScrollView>
  );
}
