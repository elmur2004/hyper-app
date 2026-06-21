import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Role } from '@prisma/client';

/**
 * The current actor, resolved from the authenticated principal (never from client params).
 * branchId is null for customers and HQ-admins; pinned for operator/manager.
 */
export interface AuthContext {
  userId: string;
  role: Role;
  branchId: string | null;
}

export function requireAuth(ctx: AuthContext | undefined): AuthContext {
  if (!ctx) throw new UnauthorizedException('authentication required');
  return ctx;
}

export function assertRole(ctx: AuthContext, ...roles: Role[]): void {
  if (!roles.includes(ctx.role)) {
    throw new ForbiddenException(`role ${ctx.role} not permitted`);
  }
}

/** HQ-admin is network-wide; operator/manager are confined to their own branch. */
export function assertBranchScope(ctx: AuthContext, branchId: string): void {
  if (ctx.role === 'hq_admin') return;
  if (ctx.branchId !== branchId) {
    throw new ForbiddenException('out of branch scope');
  }
}

/** Only HQ-admin may mutate the master catalog / prices / network-wide visibility. */
export function assertCanEditMasterCatalog(ctx: AuthContext): void {
  assertRole(ctx, 'hq_admin');
}

export const isStaff = (ctx: AuthContext): boolean =>
  ctx.role === 'branch_operator' || ctx.role === 'branch_manager' || ctx.role === 'hq_admin';
