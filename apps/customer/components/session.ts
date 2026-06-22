// Lightweight demo session: logs in the seeded demo customer via the dev OTP flow and keeps
// the token (in src/api's module state) for the app lifetime. Replace with a real OTP/login
// screen + persisted token (AsyncStorage) for production.
import { api, setToken } from '../src/api';

const DEMO_PHONE = '+201000000001';

let loggedIn = false;
let customerId: string | null = null;

/** Ensure the demo customer is authenticated (idempotent). */
export async function ensureSession(): Promise<void> {
  if (loggedIn) return;
  const { devCode } = await api.auth.requestOtp(DEMO_PHONE);
  const res = await api.auth.verifyOtp(DEMO_PHONE, devCode ?? '');
  setToken(res.token);
  customerId = res.customerId;
  loggedIn = true;
}

export const getCustomerId = (): string | null => customerId;
