// Shared React Native UI kit for the customer app (reference screens — not typechecked,
// consistent with app/). Built on the @hyper/shared B-Systems theme tokens.
import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii } from '@hyper/shared';
import { cart } from '../src/store';

export const cardShadow = {
  shadowColor: '#1D267D',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          ...cardShadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Image thumbnail with a graceful placeholder when missing or failed. */
export function Thumb({ uri, size = 56, radius = radii.md }: { uri?: string; size?: number; radius?: number }) {
  const [failed, setFailed] = useState(false);
  const base = { width: size, height: size, borderRadius: radius, backgroundColor: colors.border };
  if (uri && !failed) {
    return <Image source={{ uri }} onError={() => setFailed(true)} style={base} resizeMode="cover" />;
  }
  return (
    <View style={[base, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: size * 0.4 }}>🛍️</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  color = colors.signalPink,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        {
          backgroundColor: off ? colors.border : color,
          borderRadius: radii.md,
          paddingVertical: 15,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.92 : 1,
          ...(off ? {} : cardShadow),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Small circular button used for the qty stepper (+/−). */
export function RoundButton({
  label,
  onPress,
  size = 30,
  bg = colors.systemsIndigo,
  fg = '#fff',
}: {
  label: string;
  onPress: () => void;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: fg, fontSize: 18, fontWeight: '700', lineHeight: 20 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Live cart item count via the vanilla store + the app's own React hooks (never zustand's
 * useStore — that would bind a second React copy → "invalid hook call").
 */
export function useCartCount(): number {
  const [count, setCount] = useState(() => cart.getState().count());
  useEffect(() => {
    const update = (): void => setCount(cart.getState().count());
    update();
    return cart.subscribe(update);
  }, []);
  return count;
}

/** Live cart lines, subscribed the same safe way. */
export function useCartLines() {
  const [lines, setLines] = useState(() => cart.getState().lines);
  useEffect(() => {
    const update = (): void => setLines(cart.getState().lines);
    update();
    return cart.subscribe(update);
  }, []);
  return lines;
}

/** Header cart button with a count badge (used in the stack header). */
export function CartHeaderButton() {
  const router = useRouter();
  const count = useCartCount();
  return (
    <Pressable onPress={() => router.push('/cart')} hitSlop={10} accessibilityLabel="cart" style={{ paddingHorizontal: spacing.sm }}>
      <Text style={{ fontSize: 24 }}>🛒</Text>
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -2,
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
