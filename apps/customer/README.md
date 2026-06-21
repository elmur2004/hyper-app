# @hyper/customer — Customer mobile app (Expo React Native)

The revenue surface (Plan §1.1). It is **read-only on catalog/price/stock** and only writes
orders, via the shared, Zod-validated API client (`@hyper/shared/client`).

## What is verified here (runs in CI)
The customer-side **business logic** that consumes the shared contract:
- `src/store/cart.ts` — the cart (Zustand vanilla store): add/merge/setQty/remove/clear, count, display subtotal.
- `src/checkout.ts` — checkout view-model (`toCheckoutItems`), Arabic status labels, and
  `customerCanCancel` derived from the **shared order status machine**.
- `src/api.ts` — the shared API client instance.

`pnpm --filter @hyper/customer test` and `… typecheck` cover these (`src/`).

## What requires the Expo toolchain (not run in this environment)
The `app/` directory holds the real **Expo Router screens** (browse, cart, checkout, track)
as reference. They import `react-native` / `expo-router`, which are **not installed here**
(the full Expo runtime + Metro need a hoisted node-linker and can only be meaningfully
verified on a device/emulator — consistent with Plan §8's Detox/Maestro device-matrix E2E).

To turn this into a runnable Expo app:
1. Add a root `.npmrc` with `node-linker=hoisted` (Metro + pnpm), or use a dedicated install.
2. `pnpm --filter @hyper/customer add expo expo-router react react-native react-dom react-native-web @tanstack/react-query`
   (use `expo install` to pin compatible versions).
3. Add the Expo `main`/babel/metro config, set `EXPO_PUBLIC_API_URL`, then `expo start`.
4. Wire push notifications (Expo Notifications → FCM/APNs) and Sentry (`@sentry/react-native`) in hardening (Plan §4).

The screens already consume the same verified `src/` logic and shared client, so promoting
them to a full app is wiring, not rework.
