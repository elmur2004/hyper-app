import { z } from 'zod';

/**
 * RBAC roles — the canonical source of truth (Plan §1.2 / §4 `staff_users.role` + customer).
 * `packages/shared` is law: defined once, imported everywhere.
 */
export const RoleSchema = z.enum(['customer', 'branch-operator', 'branch-manager', 'hq-admin']);
export type Role = z.infer<typeof RoleSchema>;

/** Roles that work inside the dashboard (everything except the customer). */
export const StaffRoleSchema = z.enum(['branch-operator', 'branch-manager', 'hq-admin']);
export type StaffRole = z.infer<typeof StaffRoleSchema>;
export const STAFF_ROLES = StaffRoleSchema.options;

/**
 * Egyptian mobile in E.164. National `01X XXXX XXXX` (11 digits) → drop the leading 0,
 * prefix +20 → `+20 1X XXXXXXXX` (10 digits after +20, first digit 1, carrier digit in 0/1/2/5).
 */
export const EgyptPhoneSchema = z
  .string()
  .regex(/^\+201[0125]\d{8}$/, 'Must be a valid Egyptian mobile in E.164 (+201XXXXXXXXX)');
export type EgyptPhone = z.infer<typeof EgyptPhoneSchema>;

/**
 * Branded UUID id factory so entity ids cannot be mixed at compile time
 * (a `BranchId` is not assignable to an `OrderId`).
 */
export const brandedUuid = <B extends string>(brand: B) => z.string().uuid().brand(brand);
