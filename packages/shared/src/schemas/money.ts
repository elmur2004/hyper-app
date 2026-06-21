import { z } from 'zod';

/**
 * Money is stored and transmitted as integer **piastres** (1 EGP = 100 piastres).
 * Never JS floats for currency. Server is authoritative for all money (Plan §6).
 */
export const PiastresSchema = z.number().int('Money must be integer piastres').nonnegative();
export type Piastres = z.infer<typeof PiastresSchema>;

/** Convert piastres → EGP major units (for display/formatting only). */
export const piastresToEgp = (piastres: Piastres): number => piastres / 100;

/** Format integer piastres as an Arabic-Egypt EGP currency string. */
export function formatEgp(piastres: Piastres, locale = 'ar-EG'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EGP' }).format(
    piastres / 100,
  );
}
