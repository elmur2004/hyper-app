import { z } from 'zod';
import { brandedUuid } from './identity';
import { ProductIdSchema } from './catalog';
import { BranchIdSchema } from './branches';
import { PiastresSchema } from './money';

export const PriceSchema = z.object({
  id: brandedUuid('PriceId'),
  productId: ProductIdSchema,
  /** null = applies to all branches (base); set = per-branch override / promo window. */
  branchId: BranchIdSchema.nullable(),
  price: PiastresSchema,
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
});
export type Price = z.infer<typeof PriceSchema>;

export const PromotionTypeSchema = z.enum(['pct', 'fixed', 'bogo']);
export type PromotionType = z.infer<typeof PromotionTypeSchema>;

export const PromotionSchema = z.object({
  id: brandedUuid('PromotionId'),
  code: z.string().min(1),
  type: PromotionTypeSchema,
  value: z.number().nonnegative(),
  minSubtotal: PiastresSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  active: z.boolean(),
});
export type Promotion = z.infer<typeof PromotionSchema>;
