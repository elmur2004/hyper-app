import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { type AuthContext, isStaff } from '../../common/authz';

/** Network/branch dashboards (Plan §10 Phase 2/3). Scope follows the actor's role. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private scopeBranch(ctx: AuthContext, branchId?: string): string | undefined {
    if (!isStaff(ctx)) throw new ForbiddenException();
    return ctx.role === 'hq_admin' ? branchId : ctx.branchId ?? undefined;
  }

  /** Delivered-order revenue grouped by branch. */
  async salesByBranch(ctx: AuthContext, branchId?: string) {
    const scope = this.scopeBranch(ctx, branchId);
    const grouped = await this.prisma.order.groupBy({
      by: ['branchId'],
      where: { status: 'delivered', ...(scope ? { branchId: scope } : {}) },
      _sum: { total: true },
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      branchId: g.branchId,
      revenue: g._sum.total ?? 0,
      orders: g._count._all,
    }));
  }

  /** Order funnel: counts by status (scoped). */
  async orderFunnel(ctx: AuthContext, branchId?: string) {
    const scope = this.scopeBranch(ctx, branchId);
    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where: scope ? { branchId: scope } : {},
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status, count: g._count._all }));
  }

  /** Items at/below their low-stock threshold for a branch. */
  async stockHealth(ctx: AuthContext, branchId: string) {
    if (!isStaff(ctx)) throw new ForbiddenException();
    if (ctx.role !== 'hq_admin' && ctx.branchId !== branchId) throw new ForbiddenException();
    return this.prisma.$queryRaw<{ product_id: string; qty_available: number; low_stock_threshold: number }[]>`
      SELECT i.product_id, i.qty_available, bp.low_stock_threshold
        FROM inventory i
        JOIN branch_products bp ON bp.product_id = i.product_id AND bp.branch_id = i.branch_id
       WHERE i.branch_id = ${branchId} AND i.qty_available <= bp.low_stock_threshold
       ORDER BY i.qty_available ASC`;
  }
}
