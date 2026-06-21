import { createApiClient } from '@hyper/shared/client';

let token: string | null = null;
export const setToken = (t: string | null): void => {
  token = t;
};

/** Customer-app API client (Plan §2.1: shared Zod-validated client over the network). */
export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  getToken: () => token,
});
