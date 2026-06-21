import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AuthContext, assertBranchScope, isStaff } from '../../common/authz';

/** Courier assignment + handoff (Plan §1.2 B / Phase 3). Branch-scoped. */
@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createCourier(ctx: AuthContext, data: { branchId: string; name: string; phone: string }) {
    if (!isStaff(ctx)) throw new ForbiddenException();
    assertBranchScope(ctx, data.branchId);
    return this.prisma.courier.create({ data });
  }

  /** Assign a courier (of the same branch) to an order; records a delivery + audit. */
  async assign(ctx: AuthContext, orderId: string, courierId: string) {
    if (!isStaff(ctx)) throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('order not found');
      assertBranchScope(ctx, order.branchId);
      const courier = await tx.courier.findUnique({ where: { id: courierId } });
      if (!courier || courier.branchId !== order.branchId) {
        throw new BadRequestException('courier not in this branch');
      }
      const delivery = await tx.delivery.upsert({
        where: { orderId },
        create: { orderId, courierId, status: 'assigned', assignedAt: new Date() },
        update: { courierId, status: 'assigned', assignedAt: new Date() },
      });
      await this.audit.write(tx, {
        actorId: ctx.userId,
        action: 'delivery.assign',
        entity: 'delivery',
        entityId: delivery.id,
        after: { courierId },
      });
      return delivery;
    });
  }
}
