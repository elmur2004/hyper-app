import { describe, it, expect } from 'vitest';
import { RoleSchema, EgyptPhoneSchema } from './identity';

describe('RoleSchema', () => {
  it('accepts known roles', () => {
    expect(RoleSchema.safeParse('hq-admin').success).toBe(true);
    expect(RoleSchema.safeParse('customer').success).toBe(true);
    expect(RoleSchema.safeParse('branch-operator').success).toBe(true);
  });
  it('rejects unknown roles', () => {
    expect(RoleSchema.safeParse('superuser').success).toBe(false);
    expect(RoleSchema.safeParse('').success).toBe(false);
  });
});

describe('EgyptPhoneSchema', () => {
  it('accepts valid EG mobiles', () => {
    expect(EgyptPhoneSchema.safeParse('+201001234567').success).toBe(true); // Vodafone 010
    expect(EgyptPhoneSchema.safeParse('+201501234567').success).toBe(true); // WE 015
  });
  it('rejects malformed / non-EG numbers', () => {
    expect(EgyptPhoneSchema.safeParse('01001234567').success).toBe(false); // national, no +20
    expect(EgyptPhoneSchema.safeParse('+12025550123').success).toBe(false); // US
    expect(EgyptPhoneSchema.safeParse('+20100123456').success).toBe(false); // too short
  });
});
