// Root layout: a Stack that hosts the bottom-tab group plus the cart/track detail screens.
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@hyper/shared';

// Arabic-first: allow + force RTL before the first screen mounts.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.systemsIndigo,
          headerTitleStyle: { fontWeight: '800', color: colors.ink },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="cart" options={{ title: 'السلة' }} />
        <Stack.Screen name="track/[id]" options={{ title: 'تتبع الطلب' }} />
      </Stack>
    </>
  );
}
