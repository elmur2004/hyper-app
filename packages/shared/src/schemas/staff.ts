import { z } from 'zod';
import { brandedUuid, StaffRoleSchema, EgyptPhoneSchema } from './identity';
import { BranchIdSchema } from './branches';

/** Dashboard RBAC actors (Plan §4 staff_users). `branchId` null = HQ-admin (network-wide). */
export const StaffUserSchema = z.object({
  id: brandedUuid('StaffUserId'),
  branchId: BranchIdSchema.nullable(),
  role: StaffRoleSchema,
  phone: EgyptPhoneSchema,
  name: z.string().min(1),
});
export type StaffUser = z.infer<typeof StaffUserSchema>;
