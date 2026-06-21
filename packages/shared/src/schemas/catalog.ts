import { z } from 'zod';
import { brandedUuid } from './identity';
import { BranchIdSchema } from './branches';
import { PiastresSchema } from './money';

export const CategoryIdSchema = brandedUuid('CategoryId');
export type CategoryId = z.infer<typeof CategoryIdSchema>;

export const CategorySchema = z.object({
  id: CategoryIdSchema,
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  parentId: CategoryIdSchema.nullable(),
  sort: z.number().int(),
  imageUrl: z.string().url().nullable(),
});
export type Category = z.infer<typeof CategorySchema>;

export const ProductIdSchema = brandedUuid('ProductId');
export type ProductId = z.infer<typeof ProductIdSchema>;

/** Master catalog product. `isActive` is the HQ master kill-switch (Plan §4). */
export const ProductSchema = z.object({
  id: ProductIdSchema,
  sku: z.string().min(1),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  description: z.string().default(''),
  categoryId: CategoryIdSchema,
  basePrice: PiastresSchema,
  imageUrls: z.array(z.string().url()).default([]),
  unit: z.string().min(1),
  isActive: z.boolean(),
});
export type Product = z.infer<typeof ProductSchema>;

/** Server-set fields removed: the client never creates an authoritative product id. */
export const ProductInsertSchema = ProductSchema.omit({ id: true });
export type ProductInsert = z.infer<typeof ProductInsertSchema>;

export const BranchProductIdSchema = brandedUuid('BranchProductId');
export const BranchProductSchema = z.object({
  id: BranchProductIdSchema,
  productId: ProductIdSchema,
  branchId: BranchIdSchema,
  /** Per-branch visibility toggle (HQ/manager). */
  isListed: z.boolean(),
  lowStockThreshold: z.number().int().nonnegative(),
});
export type BranchProduct = z.infer<typeof BranchProductSchema>;

/**
 * A row of the derived `customer_catalog(branch_id)` read view — the ONLY catalog
 * surface the mobile client reads (Plan §4). Excludes operator/HQ-only columns.
 */
export const CustomerCatalogRowSchema = z.object({
  productId: ProductIdSchema,
  branchId: BranchIdSchema,
  nameAr: z.string(),
  nameEn: z.string(),
  imageUrls: z.array(z.string().url()),
  unit: z.string(),
  price: PiastresSchema,
  inStock: z.boolean(),
});
export type CustomerCatalogRow = z.infer<typeof CustomerCatalogRowSchema>;
