// REFERENCE Expo Router screen — the browse/home grid (المتجر tab). Consumes the SAME shared
// API client and verified cart store as the tested src/ logic.
import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { colors, spacing, radii, formatEgp, type CustomerCatalogRow } from '@hyper/shared';
import { api } from '../../src/api';
import { cart } from '../../src/store';
import { Card, PrimaryButton, useCartCount, cardShadow } from '../../components/ui';

const DEMO_BRANCH = process.env.EXPO_PUBLIC_DEMO_BRANCH_ID ?? '';

function ProductCard({ item }: { item: CustomerCatalogRow }) {
  const [failed, setFailed] = useState(false);
  const uri = item.imageUrls[0];
  return (
    <Card style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
      <View style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.border }}>
        {uri && !failed ? (
          <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 34 }}>🛍️</Text>
          </View>
        )}
        {!item.inStock && (
          <View
            style={{
              position: 'absolute',
              top: spacing.sm,
              right: spacing.sm,
              backgroundColor: colors.muted,
              borderRadius: radii.pill,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11 }}>غير متوفر</Text>
          </View>
        )}
      </View>

      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text numberOfLines={2} style={{ color: colors.ink, fontWeight: '600', minHeight: 38 }}>
          {item.nameAr}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.systemsIndigo, fontWeight: '800', fontSize: 16 }}>{formatEgp(item.price)}</Text>
          <Pressable
            onPress={() => cart.getState().add({ productId: item.productId, nameAr: item.nameAr, unitPrice: item.price })}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.signalPink,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
              ...cardShadow,
            })}
          >
            <Text style={{ color: '#fff', fontSize: 22, lineHeight: 24, fontWeight: '700' }}>+</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

export default function BrowseScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [rows, setRows] = useState<CustomerCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const count = useCartCount();
  const subtotal = cart.getState().subtotal();

  useEffect(() => {
    api
      .catalog(DEMO_BRANCH)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.productId}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{
          gap: spacing.md,
          padding: spacing.lg,
          paddingBottom: tabBarHeight + (count > 0 ? 88 : spacing.lg),
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>تسوّق من هايبر</Text>
            <Text style={{ color: colors.muted, marginTop: 2 }}>توصيل سريع من أقرب فرع</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: spacing.xl }}>
            {loading ? 'جارٍ تحميل المنتجات…' : 'لا توجد منتجات'}
          </Text>
        }
        renderItem={({ item }) => <ProductCard item={item} />}
      />

      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: tabBarHeight,
            padding: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <PrimaryButton label={`عرض السلة (${count}) · ${formatEgp(subtotal)}`} onPress={() => router.push('/cart')} />
        </View>
      )}
    </View>
  );
}
