// Root layout for the Expo Router app. Forces RTL (Arabic-first) and defines the stack.
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@hyper/shared';

// Arabic-first: allow + force RTL before the first screen mounts.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  useEffect(() => {
    // no-op: layout effects can go here (e.g. push-notification registration in hardening).
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        headerTitleAlign: 'center',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'هايبر' }} />
      <Stack.Screen name="cart" options={{ title: 'السلة' }} />
      <Stack.Screen name="track/[id]" options={{ title: 'تتبع الطلب' }} />
    </Stack>
  );
}
