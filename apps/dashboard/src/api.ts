import { createApiClient } from '@hyper/shared/client';
import { API_URL } from './env';

export const TOKEN_KEY = 'hyper.dashboard.token';

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => localStorage.getItem(TOKEN_KEY),
});

export interface DecodedActor {
  userId: string;
  role: string;
  branchId: string | null;
}

/** Decode the (signed) token payload for UI gating only — the server still enforces authz. */
export function decodeToken(token: string): DecodedActor | null {
  try {
    const payload = token.split('.')[0];
    if (!payload) return null;
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(atob(b64)) as DecodedActor;
  } catch {
    return null;
  }
}
