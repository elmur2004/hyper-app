// REFERENCE Expo Router screen — requires the Expo toolchain to build/run (see README).
// Excluded from the verified typecheck (tsconfig excludes app/). It consumes the SAME
// shared API client + verified cart store as the tested src/ logic.
import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Image, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, formatEgp, type CustomerCatalogRow } from '@hyper/shared';
import { api } from '../src/api';
import { cart } from '../src/store';

// Arabic-first: force RTL.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const DEMO_BRANCH = process.env.EXPO_PUBLIC_DEMO_BRANCH_ID ?? '';

/**
 * Live cart item count. Subscribes to the vanilla Zustand store with the app's OWN React
 * hooks (not zustand's `useStore`) so we never risk binding a second copy of React in the
 * hoisted monorepo (that triggers "invalid hook call").
 */
function useCartCount(): number {
  const [count, setCount] = useState(() => cart.getState().count());
  useEffect(() => {
    const update = (): void => setCount(cart.getState().count());
    update(); // sync any items added before mount
    return cart.subscribe(update);
  }, []);
  return count;
}

/** Product thumbnail with a graceful placeholder when there is no image (or it fails to load). */
function Thumb({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  const size = { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.border };
  if (uri && !failed) {
    return <Image source={{ uri }} onError={() => setFailed(true)} style={size} />;
  }
  return (
    <View style={[size, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: 22 }}>🛍️</Text>
    </View>
  );
}

/** Cart icon with a live item-count badge — subscribes to the shared cart store. */
function CartButton() {
  const router = useRouter();
  const count = useCartCount();
  return (
    <Pressable onPress={() => router.push('/cart')} hitSlop={10} accessibilityLabel="cart">
      <Text style={{ fontSize: 26 }}>🛒</Text>
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -6,
            right: -10,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: colors.signalPink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function BrowseScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<CustomerCatalogRow[]>([]);
  const count = useCartCount();

  useEffect(() => {
    api.catalog(DEMO_BRANCH).then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ fontSize: 24, color: colors.ink }}>المنتجات</Text>
        <CartButton />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.productId}
        ListEmptyComponent={<Text style={{ color: colors.muted }}>لا توجد منتجات</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => cart.getState().add({ productId: item.productId, nameAr: item.nameAr, unitPrice: item.price })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.md,
              borderBottomWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Thumb uri={item.imageUrls[0]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink }}>{item.nameAr}</Text>
              <Text style={{ color: colors.muted }}>{formatEgp(item.price)}</Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => router.push('/cart')}
        style={{ backgroundColor: colors.signalPink, padding: spacing.md, borderRadius: 10 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center' }}>
          السلة{count > 0 ? ` (${count})` : ''}
        </Text>
      </Pressable>
    </View>
  );
}
