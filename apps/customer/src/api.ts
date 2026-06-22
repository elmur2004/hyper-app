import Constants from 'expo-constants';
import { createApiClient } from '@hyper/shared/client';

// Derive the API host from the Expo dev server — the LAN IP the device already reached Metro
// on — so it survives the Mac's IP changing between sessions. EXPO_PUBLIC_API_URL overrides
// (e.g. for production / a remote API). API port is 7001.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const baseUrl =
  process.env.EXPO_PUBLIC_API_URL ?? (devHost ? `http://${devHost}:7001` : 'http://localhost:7001');

let token: string | null = null;
export const setToken = (t: string | null): void => {
  token = t;
};

/** Customer-app API client (Plan §2.1: shared Zod-validated client over the network). */
export const api = createApiClient({
  baseUrl,
  getToken: () => token,
});
