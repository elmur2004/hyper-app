import { z } from 'zod';
import { brandedUuid } from './identity';
import { CustomerIdSchema } from './customers';
import { BranchIdSchema } from './branches';
import { ProductIdSchema } from './catalog';
import { PiastresSchema } from './money';

export const CartIdSchema = brandedUuid('CartId');
export type CartId = z.infer<typeof CartIdSchema>;

export const CartStatusSchema = z.enum(['active', 'converted', 'abandoned']);
export type CartStatus = z.infer<typeof CartStatusSchema>;

export const CartSchema = z.object({
  id: CartIdSchema,
  customerId: CustomerIdSchema,
  branchId: BranchIdSchema.nullable(),
  status: CartStatusSchema,
});
export type Cart = z.infer<typeof CartSchema>;

export const CartItemSchema = z.object({
  id: brandedUuid('CartItemId'),
  cartId: CartIdSchema,
  productId: ProductIdSchema,
  qty: z.number().int().positive(),
  /** Display snapshot only — the server recomputes the charged price at checkout (Plan §6). */
  unitPriceSnapshot: PiastresSchema,
});
export type CartItem = z.infer<typeof CartItemSchema>;
