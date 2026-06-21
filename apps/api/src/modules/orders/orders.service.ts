import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PaymentMethod } from '@prisma/client';
import { assertTransition, type OrderStatus } from '@hyper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RoutingService } from '../routing/routing.service';
import { RealtimePublisher } from '../../common/realtime.publisher';
import { PromotionsService } from '../promotions/promotions.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { tryReserve, tryRelease, tryFulfill, type Db } from '../inventory/reservation';
import { type AuthContext, assertBranchScope } from '../../common/authz';

export interface CheckoutItem {
  productId: string;
  qty: number;
  /** Optional client display hint — the server IGNORES it and recomputes (Plan §6). */
  clientPriceHint?: number;
}
export interface CheckoutInput {
  customerId: string;
  addressId: string;
  items: CheckoutItem[];
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  promoCode?: string;
}

const DELIVERY_FEE = 2000; // piastres (flat for now)

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: RoutingService,
    private readonly realtime: RealtimePublisher,
    private readonly promotions: PromotionsService,
    private readonly loyalty: LoyaltyService,
  ) {}

  /**
   * Server-authoritative price for an active+listed+priced product — INDEPENDENT of stock.
   * (Using customer_catalog here would conflate "out of stock" with "no price"; stock is the
   * reservation step's sole concern, so a depleted item fails as OUT_OF_STOCK, not "unavailable".)
   */
  private async resolvePriceTx(db: Db, branchId: string, productId: string): Promise<number | null> {
    const rows = await db.$queryRaw<{ price: number }[]>`
      SELECT rp.price
        FROM products p
        JOIN branch_products bp ON bp.product_id = p.id AND bp.branch_id = ${branchId}
        JOIN LATERAL (
          SELECT pr.price FROM prices pr
           WHERE pr.product_id = p.id
             AND (pr.branch_id = ${branchId} OR pr.branch_id IS NULL)
             AND (pr.starts_at IS NULL OR pr.starts_at <= now())
             AND (pr.ends_at   IS NULL OR pr.ends_at   >= now())
           ORDER BY (pr.branch_id = ${branchId}) DESC NULLS LAST, pr.starts_at DESC NULLS LAST
           LIMIT 1
        ) rp ON true
       WHERE p.id = ${productId} AND p.is_active = true AND bp.is_listed = true
       LIMIT 1`;
    return rows[0] ? Number(rows[0].price) : null;
  }

  /**
   * Server-authoritative checkout: route address→branch, recompute every price on the
   * server, reserve stock atomically, and persist order + idempotency key in ONE
   * transaction. Double-submit is exactly-once via the idempotency key's unique index;
   * any failed reservation rolls the whole thing back (releasing earlier reserves).
   */
  async checkout(input: CheckoutInput) {
    if (input.items.length === 0) throw new BadRequestException('empty cart');

    const address = await this.prisma.address.findUnique({ where: { id: input.addressId } });
    if (!address || address.customerId !== input.customerId) {
      throw new BadRequestException('invalid address');
    }
    const zone = await this.routing.resolve({ lat: address.lat, lng: address.lng });
    if (zone.status !== 'in_zone') {
      throw new BadRequestException('we do not deliver to this address yet');
    }
    const branchId = zone.branchId;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Idempotency guard: this insert blocks a concurrent duplicate and throws P2002 on replay.
        await tx.idempotencyKey.create({ data: { key: input.idempotencyKey } });

        let subtotal = 0;
        const lines: { productId: string; qty: number; unitPrice: number; lineTotal: number }[] = [];
        for (const item of input.items) {
          if (item.qty <= 0) throw new BadRequestException('invalid qty');
          const price = await this.resolvePriceTx(tx, branchId, item.productId);
          if (price == null) throw new BadRequestException(`product ${item.productId} not available`);
          const reserved = await tryReserve(tx, branchId, item.productId, item.qty);
          if (!reserved) throw new ConflictException('OUT_OF_STOCK');
          const lineTotal = price * item.qty;
          subtotal += lineTotal;
          lines.push({ productId: item.productId, qty: item.qty, unitPrice: price, lineTotal });
        }

        const discount = input.promoCode
          ? await this.promotions.resolveDiscount(tx, input.promoCode, subtotal)
          : 0;
        const total = subtotal + DELIVERY_FEE - discount;
        const order = await tx.order.create({
          data: {
            customerId: input.customerId,
            branchId,
            addressId: input.addressId,
            status: 'placed',
            subtotal,
            deliveryFee: DELIVERY_FEE,
            discount,
            total,
            paymentMethod: input.paymentMethod,
            items: { create: lines },
          },
          include: { items: true },
        });
        await tx.orderEvent.create({
          data: { orderId: order.id, status: 'placed', actor: `customer:${input.customerId}` },
        });
        await tx.idempotencyKey.update({
          where: { key: input.idempotencyKey },
          data: { orderId: order.id },
        });
        await this.realtime.publishStatus(tx, order);
        return order;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const k = await this.prisma.idempotencyKey.findUnique({ where: { key: input.idempotencyKey } });
        if (k?.orderId) {
          return this.prisma.order.findUniqueOrThrow({
            where: { id: k.orderId },
            include: { items: true },
          });
        }
      }
      throw e;
    }
  }

  /** Drive the status machine (staff only). Releases/fulfills stock on cancel/deliver. */
  async transition(ctx: AuthContext, orderId: string, to: OrderStatus, note?: string) {
    if (ctx.role === 'customer') throw new ForbiddenException('customers cannot drive order status');
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('order not found');
      assertBranchScope(ctx, order.branchId);
      assertTransition(order.status as OrderStatus, to); // shared machine; illegal → throws
      const version = order.version + 1;
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: to, version },
      });
      await tx.orderEvent.create({
        data: { orderId, status: to, actor: `${ctx.role}:${ctx.userId}`, note: note ?? null },
      });
      if (to === 'cancelled') {
        for (const it of order.items) await tryRelease(tx, order.branchId, it.productId, it.qty);
      }
      if (to === 'delivered') {
        for (const it of order.items) await tryFulfill(tx, order.branchId, it.productId, it.qty);
        await this.loyalty.earn(tx, order.customerId, order.id, order.total); // Phase 5: earn points
      }
      await this.realtime.publishStatus(tx, updated);
      return updated;
    });
  }

  /** Ops-initiated return on a DELIVERED order: → refunded, restock items, refund payment. */
  async initiateReturn(ctx: AuthContext, orderId: string, reason?: string) {
    if (ctx.role === 'customer') throw new ForbiddenException('returns are ops-initiated');
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('order not found');
      assertBranchScope(ctx, order.branchId);
      assertTransition(order.status as OrderStatus, 'refunded'); // only delivered→refunded is legal
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: 'refunded', version: order.version + 1, paymentStatus: 'refunded' },
      });
      await tx.orderEvent.create({
        data: { orderId, status: 'refunded', actor: `${ctx.role}:${ctx.userId}`, note: reason ?? 'return' },
      });
      // Returned goods come back to available stock.
      for (const it of order.items) {
        await tx.$executeRaw`
          UPDATE inventory SET qty_available = qty_available + ${it.qty}, updated_at = now()
           WHERE branch_id = ${order.branchId} AND product_id = ${it.productId}`;
      }
      await this.loyalty.reverseForOrder(tx, order.customerId, order.id); // claw back earned points
      await this.realtime.publishStatus(tx, updated);
      return updated;
    });
  }

  /** Owner-scoped read: customer→own (404 otherwise, no leak); staff→own branch; admin→any. */
  async getForActor(ctx: AuthContext, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('order not found');
    if (ctx.role === 'customer') {
      if (order.customerId !== ctx.userId) throw new NotFoundException('order not found');
    } else if (ctx.role !== 'hq_admin') {
      if (order.branchId !== ctx.branchId) throw new ForbiddenException('out of branch scope');
    }
    return order;
  }

  listForCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      orderBy: { placedAt: 'desc' },
      include: { items: true },
    });
  }

  /** Real-time branch order queue (ops). Operator/manager→own branch; admin→any/filter. */
  branchQueue(ctx: AuthContext, branchId?: string) {
    if (ctx.role === 'customer') throw new ForbiddenException();
    const scope = ctx.role === 'hq_admin' ? branchId : ctx.branchId ?? undefined;
    return this.prisma.order.findMany({
      where: {
        ...(scope ? { branchId: scope } : {}),
        status: { in: ['placed', 'confirmed', 'picking', 'packed', 'out_for_delivery'] },
      },
      orderBy: { placedAt: 'asc' },
      include: { items: true },
    });
  }

  async reorder(customerId: string, orderId: string, idempotencyKey: string) {
    const prev = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!prev || prev.customerId !== customerId) throw new NotFoundException('order not found');
    return this.checkout({
      customerId,
      addressId: prev.addressId,
      items: prev.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      paymentMethod: prev.paymentMethod,
      idempotencyKey,
    });
  }
}
