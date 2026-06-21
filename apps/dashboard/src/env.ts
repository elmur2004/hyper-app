/** Client-safe config only (VITE_ prefix). Server secrets are never referenced here. */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
export const SENTRY_DSN: string | undefined = import.meta.env.VITE_SENTRY_DSN as string | undefined;
