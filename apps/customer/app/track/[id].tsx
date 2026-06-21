// REFERENCE Expo Router screen (order tracking) — see README. Realtime is an optimization
// over REST: this refetches authoritative state and would subscribe to the order channel.
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, spacing } from '@hyper/shared';
import { api } from '../../src/api';
import { STATUS_LABEL_AR } from '../../src/checkout';
import type { OrderWithItems } from '@hyper/shared/client';

export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithItems | null>(null);

  useEffect(() => {
    if (id) api.orders.get(id).then(setOrder).catch(() => setOrder(null));
  }, [id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <Text style={{ fontSize: 22, color: colors.ink }}>تتبع الطلب</Text>
      {order && (
        <Text style={{ marginTop: spacing.md, color: colors.systemsIndigo, fontSize: 18 }}>
          {STATUS_LABEL_AR[order.status]}
        </Text>
      )}
    </View>
  );
}
