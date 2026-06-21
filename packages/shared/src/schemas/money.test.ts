import { describe, it, expect } from 'vitest';
import { PiastresSchema, formatEgp, piastresToEgp } from './money';

describe('PiastresSchema', () => {
  it('accepts non-negative integers', () => {
    expect(PiastresSchema.safeParse(0).success).toBe(true);
    expect(PiastresSchema.safeParse(150050).success).toBe(true);
  });
  it('rejects floats and negatives (no float money)', () => {
    expect(PiastresSchema.safeParse(10.5).success).toBe(false);
    expect(PiastresSchema.safeParse(-1).success).toBe(false);
  });
});

describe('formatEgp', () => {
  it('formats integer piastres as EGP major units', () => {
    expect(piastresToEgp(150050)).toBe(1500.5);
    // ar-EG renders Arabic-Indic digits; use a Latin-digit locale for a stable assertion.
    expect(formatEgp(150050, 'en-EG')).toContain('1,500.5');
    // Default ar-EG still returns a non-empty currency string.
    expect(formatEgp(150050).length).toBeGreaterThan(0);
  });
});
