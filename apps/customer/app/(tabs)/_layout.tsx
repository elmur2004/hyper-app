// Bottom-tab navigator: المتجر (browse) + طلباتي (order history).
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@hyper/shared';
import { CartHeaderButton } from '../../components/ui';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '800', color: colors.ink },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.signalPink,
        tabBarInactiveTintColor: colors.muted,
        // Height must include the bottom safe-area inset, else the label clips on devices
        // with a home indicator. paddingBottom lifts the label/icon above that inset.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'المتجر',
          headerTitle: 'هايبر',
          headerRight: () => <CartHeaderButton />,
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'طلباتي',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
