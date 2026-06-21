import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthContext } from '../src/common/authz';
import { startApiTestDb, type ApiTestDb } from './harness';
import { seed, type SeedResult } from './seed';
import { AdminService } from '../src/modules/admin/admin.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';

let db: ApiTestDb;
let s: SeedResult;
let admin: AdminService;
let catalog: CatalogService;

const asAdmin = (): AuthContext => ({ userId: 'admin', role: 'hq_admin', branchId: null });
const asOperatorA = (): AuthContext => ({ userId: 'opA', role: 'branch_operator', branchId: '' });
const asManagerB = (branchB: string): AuthContext => ({ userId: 'mgrB', role: 'branch_manager', branchId: branchB });

beforeAll(async () => {
  db = await startApiTestDb(54343);
  s = await seed(db.prisma);
  const prisma = db.prisma as unknown as PrismaService;
  admin = new AdminService(prisma, new AuditService());
  catalog = new CatalogService(prisma);
});
afterAll(async () => {
  await db?.stop();
});

describe('Phase 2 — Central Command RBAC (§11: only admin edits master catalog/prices)', () => {
  it('an operator cannot create a product or set a price', async () => {
    await expect(
      admin.createProduct(asOperatorA(), {
        sku: 'X',
        nameAr: 'منتج',
        nameEn: 'X',
        categoryId: s.category,
        basePrice: 1000,
        unit: 'ea',
      }),
    ).rejects.toThrow();
    await expect(admin.setPrice(asOperatorA(), s.milk, s.branchA, 1)).rejects.toThrow();
  });

  it('HQ-admin can create a product and it is audit-logged', async () => {
    const product = await admin.createProduct(asAdmin(), {
      sku: 'YOGHURT',
      nameAr: 'زبادي',
      nameEn: 'Yoghurt',
      categoryId: s.category,
      basePrice: 1500,
      unit: 'ea',
    });
    expect(product.id).toBeTruthy();
    const audits = await db.prisma.auditLog.findMany({ where: { entityId: product.id } });
    expect(audits.some((a) => a.action === 'product.create')).toBe(true);
  });

  it('a manager can set listing only for their own branch', async () => {
    await expect(
      admin.setBranchListing(asManagerB(s.branchB), s.milk, s.branchA, false),
    ).rejects.toThrow(); // cross-branch denied
    const ok = await admin.setBranchListing(asManagerB(s.branchB), s.milk, s.branchB, true);
    expect(ok.isListed).toBe(true);
  });
});

describe('Phase 2 — visibility control reflects in the customer catalog live (§11 gate)', () => {
  it('HQ unpublish (master kill-switch) removes the product from the customer app read', async () => {
    // milk is visible in branch A initially
    let rows = await catalog.forBranch(s.branchA);
    expect(rows.map((r) => r.productId)).toContain(s.milk);

    await admin.setProductActive(asAdmin(), s.milk, false); // network-wide hide
    rows = await catalog.forBranch(s.branchA);
    expect(rows.map((r) => r.productId)).not.toContain(s.milk);

    await admin.setProductActive(asAdmin(), s.milk, true); // restore
    rows = await catalog.forBranch(s.branchA);
    expect(rows.map((r) => r.productId)).toContain(s.milk);
  });
});
