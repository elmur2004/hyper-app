import { z } from 'zod';
import { brandedUuid } from './identity';
import { ProductIdSchema } from './catalog';
import { BranchIdSchema } from './branches';

export const InventoryIdSchema = brandedUuid('InventoryId');

/** Authoritative per-branch stock ledger (Plan §4). Invariants also enforced by DB CHECKs. */
export const InventorySchema = z.object({
  id: InventoryIdSchema,
  productId: ProductIdSchema,
  branchId: BranchIdSchema,
  qtyAvailable: z.number().int().nonnegative(),
  qtyReserved: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type Inventory = z.infer<typeof InventorySchema>;

// --- Reservation contract (spike S1) — server-authoritative atomic move ---

export const ReservationRequestSchema = z.object({
  branchId: BranchIdSchema,
  productId: ProductIdSchema,
  qty: z.number().int().positive(),
});
export type ReservationRequest = z.infer<typeof ReservationRequestSchema>;

export const ReservationErrorCodeSchema = z.enum(['OUT_OF_STOCK', 'NOT_FOUND', 'INVALID_QTY']);
export type ReservationErrorCode = z.infer<typeof ReservationErrorCodeSchema>;

/** Result is a discriminated union on `ok` so OUT_OF_STOCK is a typed result, not a 500. */
export const ReservationResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    qtyAvailable: z.number().int().nonnegative(),
    qtyReserved: z.number().int().nonnegative(),
  }),
  z.object({
    ok: z.literal(false),
    error: ReservationErrorCodeSchema,
  }),
]);
export type ReservationResult = z.infer<typeof ReservationResultSchema>;
