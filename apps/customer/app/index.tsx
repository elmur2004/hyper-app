// REFERENCE Expo Router screen — requires the Expo toolchain to build/run (see README).
// Excluded from the verified typecheck (tsconfig excludes app/). It consumes the SAME
// shared API client + verified cart store as the tested src/ logic.
import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, formatEgp, type CustomerCatalogRow } from '@hyper/shared';
import { api } from '../src/api';
import { cart } from '../src/store';

// Arabic-first: force RTL.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const DEMO_BRANCH = process.env.EXPO_PUBLIC_DEMO_BRANCH_ID ?? '';

export default function BrowseScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<CustomerCatalogRow[]>([]);

  useEffect(() => {
    api.catalog(DEMO_BRANCH).then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <Text style={{ fontSize: 24, color: colors.ink, marginBottom: spacing.md }}>المنتجات</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.productId}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => cart.getState().add({ productId: item.productId, nameAr: item.nameAr, unitPrice: item.price })}
            style={{ padding: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.ink }}>{item.nameAr}</Text>
            <Text style={{ color: colors.muted }}>{formatEgp(item.price)}</Text>
          </Pressable>
        )}
      />
      <Pressable
        onPress={() => router.push('/cart')}
        style={{ backgroundColor: colors.signalPink, padding: spacing.md, borderRadius: 10 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center' }}>السلة</Text>
      </Pressable>
    </View>
  );
}
