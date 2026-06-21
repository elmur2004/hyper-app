import type { Pool } from 'pg';
import type { ReservationRequest, ReservationResult } from '@hyper/shared';

/**
 * Spike S1 inventory schema. The invariant `qty_available >= 0` is enforced by the DB
 * itself (CHECK), so even a buggy app path fails loudly rather than overselling.
 * (T0.3 will own the full §4 schema via Prisma; this is the focused spike substrate.)
 */
export const INVENTORY_DDL = `
CREATE TABLE IF NOT EXISTS inventory (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL,
  branch_id     uuid NOT NULL,
  qty_available integer NOT NULL DEFAULT 0,
  qty_reserved  integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_branch_product_uniq UNIQUE (branch_id, product_id),
  CONSTRAINT inventory_qty_available_nonneg CHECK (qty_available >= 0),
  CONSTRAINT inventory_qty_reserved_nonneg  CHECK (qty_reserved  >= 0)
);
`;

interface QtyRow {
  qty_available: number;
  qty_reserved: number;
}

async function exists(pool: Pool, branchId: string, productId: string): Promise<boolean> {
  const r = await pool.query('SELECT 1 FROM inventory WHERE branch_id = $1 AND product_id = $2', [
    branchId,
    productId,
  ]);
  return r.rowCount === 1;
}

/**
 * Server-authoritative atomic reservation: move `qty` from available → reserved IFF
 * `qty_available >= qty`, in a single conditional UPDATE. Postgres serializes concurrent
 * writers on the row lock and re-checks the predicate, so exactly one of N racers wins.
 * No read-then-write in app code (no TOCTOU); no Redis lock (the DB is the arbiter).
 */
export async function placeReservation(
  pool: Pool,
  req: ReservationRequest,
): Promise<ReservationResult> {
  if (req.qty <= 0) return { ok: false, error: 'INVALID_QTY' };
  const res = await pool.query<QtyRow>(
    `UPDATE inventory
        SET qty_available = qty_available - $3,
            qty_reserved  = qty_reserved  + $3,
            updated_at    = now()
      WHERE branch_id = $1 AND product_id = $2 AND qty_available >= $3
      RETURNING qty_available, qty_reserved`,
    [req.branchId, req.productId, req.qty],
  );
  const row = res.rows[0];
  if (res.rowCount === 1 && row) {
    return { ok: true, qtyAvailable: row.qty_available, qtyReserved: row.qty_reserved };
  }
  return { ok: false, error: (await exists(pool, req.branchId, req.productId)) ? 'OUT_OF_STOCK' : 'NOT_FOUND' };
}

/** Cancel: return `qty` from reserved → available (order cancelled before fulfillment). */
export async function cancelReservation(
  pool: Pool,
  req: ReservationRequest,
): Promise<ReservationResult> {
  if (req.qty <= 0) return { ok: false, error: 'INVALID_QTY' };
  const res = await pool.query<QtyRow>(
    `UPDATE inventory
        SET qty_available = qty_available + $3,
            qty_reserved  = qty_reserved  - $3,
            updated_at    = now()
      WHERE branch_id = $1 AND product_id = $2 AND qty_reserved >= $3
      RETURNING qty_available, qty_reserved`,
    [req.branchId, req.productId, req.qty],
  );
  const row = res.rows[0];
  if (res.rowCount === 1 && row) {
    return { ok: true, qtyAvailable: row.qty_available, qtyReserved: row.qty_reserved };
  }
  return { ok: false, error: (await exists(pool, req.branchId, req.productId)) ? 'OUT_OF_STOCK' : 'NOT_FOUND' };
}

/** Fulfill: decrement reserved only (stock physically leaves on fulfillment). */
export async function fulfillReservation(
  pool: Pool,
  req: ReservationRequest,
): Promise<ReservationResult> {
  if (req.qty <= 0) return { ok: false, error: 'INVALID_QTY' };
  const res = await pool.query<QtyRow>(
    `UPDATE inventory
        SET qty_reserved = qty_reserved - $3,
            updated_at   = now()
      WHERE branch_id = $1 AND product_id = $2 AND qty_reserved >= $3
      RETURNING qty_available, qty_reserved`,
    [req.branchId, req.productId, req.qty],
  );
  const row = res.rows[0];
  if (res.rowCount === 1 && row) {
    return { ok: true, qtyAvailable: row.qty_available, qtyReserved: row.qty_reserved };
  }
  return { ok: false, error: (await exists(pool, req.branchId, req.productId)) ? 'OUT_OF_STOCK' : 'NOT_FOUND' };
}
