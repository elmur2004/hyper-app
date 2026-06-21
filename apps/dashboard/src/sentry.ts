import { SENTRY_DSN } from './env';

/**
 * Sentry placeholder (Plan §2.6 / T0.1.6): a no-op until a DSN is configured, so error
 * tracking is wired without a real DSN in the repo. Swap for @sentry/react in hardening.
 */
export function initSentry(): void {
  if (!SENTRY_DSN) return;
  // TODO(hardening): Sentry.init({ dsn: SENTRY_DSN, ... }) with @sentry/react.
}
