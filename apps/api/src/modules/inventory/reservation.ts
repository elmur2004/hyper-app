import { Prisma, PrismaClient } from '@prisma/client';

/** Works with the base client or a transaction client (for in-checkout reservation). */
export type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Atomic compare-and-decrement (graduated from spike S1): move `qty` available→reserved
 * IFF qty_available >= qty. Returns true iff exactly one row was updated. The DB row lock
 * serializes concurrent callers; CHECK(qty_available>=0) is the backstop. No Redis lock.
 */
export async function tryReserve(
  db: Db,
  branchId: string,
  productId: string,
  qty: number,
): Promise<boolean> {
  const affected = await db.$executeRaw`
    UPDATE inventory
       SET qty_available = qty_available - ${qty},
           qty_reserved  = qty_reserved  + ${qty},
           updated_at    = now()
     WHERE branch_id = ${branchId} AND product_id = ${productId} AND qty_available >= ${qty}`;
  return affected === 1;
}

/** Return reserved units to available (order cancelled before fulfillment). */
export async function tryRelease(
  db: Db,
  branchId: string,
  productId: string,
  qty: number,
): Promise<boolean> {
  const affected = await db.$executeRaw`
    UPDATE inventory
       SET qty_available = qty_available + ${qty},
           qty_reserved  = qty_reserved  - ${qty},
           updated_at    = now()
     WHERE branch_id = ${branchId} AND product_id = ${productId} AND qty_reserved >= ${qty}`;
  return affected === 1;
}

/** Consume reserved units on fulfillment (stock physically leaves). */
export async function tryFulfill(
  db: Db,
  branchId: string,
  productId: string,
  qty: number,
): Promise<boolean> {
  const affected = await db.$executeRaw`
    UPDATE inventory
       SET qty_reserved = qty_reserved - ${qty},
           updated_at   = now()
     WHERE branch_id = ${branchId} AND product_id = ${productId} AND qty_reserved >= ${qty}`;
  return affected === 1;
}
