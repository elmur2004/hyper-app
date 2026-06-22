import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  type AuthContext,
  assertCanEditMasterCatalog,
  assertBranchScope,
  isStaff,
} from '../../common/authz';

export interface CreateProductInput {
  sku: string;
  nameAr: string;
  nameEn: string;
  categoryId: string;
  basePrice: number;
  unit: string;
  imageUrls?: string[];
}

/**
 * Central Command writes (Plan §1.2 A). The dashboard catalog/inventory/pricing tables are
 * the single source of truth; only HQ-admin defines master catalog/prices/visibility, while
 * branch staff manage their own stock/listings. Every mutation writes audit_log in the
 * same transaction.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Master catalog (HQ-admin only) ----

  async createProduct(ctx: AuthContext, input: CreateProductInput) {
    assertCanEditMasterCatalog(ctx);
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku: input.sku,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          categoryId: input.categoryId,
          basePrice: input.basePrice,
          unit: input.unit,
          imageUrls: input.imageUrls ?? [],
        },
      });
      await this.audit.write(tx, {
        actorId: ctx.userId,
        action: 'product.create',
        entity: 'product',
        entityId: product.id,
        after: product,
      });
      return product;
    });
  }

  /** Master kill-switch — hides a product network-wide instantly (HQ-admin only). */
  async setProductActive(ctx: AuthContext, productId: string, isActive: boolean) {
    assertCanEditMasterCatalog(ctx);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id: productId } });
      if (!before) throw new NotFoundException('product not found');
      const after = await tx.product.update({ where: { id: productId }, data: { isActive } });
      await this.audit.write(tx, {
        actorId: ctx.userId,
        action: 'product.setActive',
        entity: 'product',
        entityId: productId,
        before: { isActive: before.isActive },
        after: { isActive },
      });
      return after;
    });
  }

  /** Per-branch visibility — HQ-admin (any branch) or that branch's manager. */
  async setBranchListing(ctx: AuthContext, productId: string, branchId: string, isListed: boolean) {
    if (ctx.role !== 'hq_admin') {
      if (ctx.role !== 'branch_manager') throw new ForbiddenException('not permitted');
      assertBranchScope(ctx, branchId);
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.branchProduct.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: { productId, branchId, isListed },
        update: { isListed },
      });
      await this.audit.write(tx, {
        actorId: ctx.userId,
        action: 'branchProduct.setListed',
        entity: 'branch_product',
        entityId: row.id,
        after: { isListed },
      });
      return row;
    });
  }

  /** Pricing — base or per-branch override / promo window (HQ-admin only). */
  async setPrice(
    ctx: AuthContext,
    productId: string,
    branchId: string | null,
    price: number,
    window?: { startsAt?: Date; endsAt?: Date },
  ) {
    assertCanEditMasterCatalog(ctx);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.price.create({
        data: {
          productId,
          branchId,
          price,
          startsAt: window?.startsAt ?? null,
          endsAt: window?.endsAt ?? null,
        },
      });
      await this.audit.write(tx, {
        actorId: ctx.userId,
        action: 'price.set',
        entity: 'price',
        entityId: row.id,
        after: { productId, branchId, price },
      });
      return row;
    });
  }

  // ---- Stock (branch staff for their branch, or HQ-admin) ----

  async setStock(ctx: AuthContext, branchId: string, productId: string, qtyAvailable: number) {
    if (!isStaff(ctx)) throw new ForbiddenException('not permitted');
    assertBranchScope(ctx, branchId);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.inventory.findUnique({
        where: { productId_branchId: { productId, branchId } },
      });
      const after = await tx.inventory.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: { productId, branchId, qtyAvailable },
        update: { qtyAvailable },
      });
      await this.audit.write(tx, {
        actorId: ctx.userId,
        action: 'inventory.setAvailable',
        entity: 'inventory',
        entityId: after.id,
        before: before ? { qtyAvailable: before.qtyAvailable } : undefined,
        after: { qtyAvailable },
      });
      return after;
    });
  }

  // ---- Branches / zones / staff (HQ-admin only) ----

  /** List branches for staff UIs (HQ sees all; branch staff see only their own). */
  async listBranches(ctx: AuthContext) {
    if (!isStaff(ctx)) throw new ForbiddenException('not permitted');
    return this.prisma.branch.findMany({
      where: ctx.role === 'hq_admin' ? {} : { id: ctx.branchId ?? undefined },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /** List categories for the catalog-admin product form (any staff). */
  async listCategories(ctx: AuthContext) {
    if (!isStaff(ctx)) throw new ForbiddenException('not permitted');
    return this.prisma.category.findMany({
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: 'asc' },
    });
  }

  /** Master product list with per-branch stock — drives the catalog-admin table. */
  async listProducts(ctx: AuthContext) {
    if (!isStaff(ctx)) throw new ForbiddenException('not permitted');
    return this.prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        nameAr: true,
        nameEn: true,
        basePrice: true,
        unit: true,
        isActive: true,
        imageUrls: true,
        inventory: { select: { branchId: true, qtyAvailable: true } },
      },
      orderBy: { nameAr: 'asc' },
    });
  }

  async createBranch(ctx: AuthContext, data: { name: string; lat: number; lng: number; prepTimeMin?: number }) {
    assertCanEditMasterCatalog(ctx);
    return this.prisma.branch.create({ data });
  }

  async createZone(ctx: AuthContext, branchId: string, priority: number, polygon: object) {
    assertCanEditMasterCatalog(ctx);
    return this.prisma.deliveryZone.create({ data: { branchId, priority, polygon } });
  }

  async createStaff(
    ctx: AuthContext,
    data: { name: string; phone: string; role: 'branch_operator' | 'branch_manager' | 'hq_admin'; branchId: string | null },
  ) {
    assertCanEditMasterCatalog(ctx);
    return this.prisma.staffUser.create({ data });
  }

  async createPromotion(
    ctx: AuthContext,
    data: {
      code: string;
      type: 'pct' | 'fixed' | 'bogo';
      value: number;
      minSubtotal: number;
      startsAt: Date;
      endsAt: Date;
    },
  ) {
    assertCanEditMasterCatalog(ctx);
    return this.prisma.$transaction(async (tx) => {
      const promo = await tx.promotion.create({ data: { ...data, active: true } });
      await this.audit.write(tx, {
        actorId: ctx.userId,
        action: 'promotion.create',
        entity: 'promotion',
        entityId: promo.id,
        after: { code: data.code, type: data.type, value: data.value },
      });
      return promo;
    });
  }
}
