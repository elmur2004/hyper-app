import type { Pool } from 'pg';
import { Client as PgClient } from 'pg';
import {
  type OrderStatus,
  type OrderStatusEvent,
  OrderStatusEventSchema,
  assertTransition,
  orderChannelName,
} from '@hyper/shared';
import type { DbConfig } from './harness';

/**
 * Spike S3 substrate. Realtime is an OPTIMIZATION over REST (Plan §5): the authoritative
 * state always lives in Postgres; the push is best-effort and the client refetches the
 * truth on reconnect. Transport here is Postgres LISTEN/NOTIFY — `pg_notify` is
 * transactional, so events are delivered ONLY on COMMIT (post-commit by construction, no
 * phantom events on rollback). In production this transport swaps for managed realtime /
 * Socket.IO rooms (ADR-0001) keeping the SAME OrderStatusEvent contract + channel-per-order.
 */
export const ORDERS_DDL = `
CREATE TABLE IF NOT EXISTS orders (
  id          uuid PRIMARY KEY,
  customer_id uuid NOT NULL,
  branch_id   uuid NOT NULL,
  status      text NOT NULL,
  version     integer NOT NULL DEFAULT 0
);
`;

export interface OrderState {
  status: OrderStatus;
  version: number;
  branchId: string;
  customerId: string;
}

type ReadResult = OrderState | 'forbidden' | 'not_found';

interface OrderRow {
  customer_id: string;
  branch_id: string;
  status: OrderStatus;
  version: number;
}

/** Authoritative read (the GET /orders/:id the reconnect refetch uses). Owner-scoped. */
export async function getOrder(
  pool: Pool,
  orderId: string,
  requesterCustomerId: string,
): Promise<ReadResult> {
  const r = await pool.query<OrderRow>(
    'SELECT customer_id, branch_id, status, version FROM orders WHERE id = $1',
    [orderId],
  );
  const row = r.rows[0];
  if (!row) return 'not_found';
  if (row.customer_id !== requesterCustomerId) return 'forbidden'; // data-layer authz (403/404)
  return { status: row.status, version: row.version, branchId: row.branch_id, customerId: row.customer_id };
}

/**
 * Server-authoritative status transition: re-check + bump version inside a transaction,
 * validate via the shared status machine, then publish post-commit on channel-per-order.
 */
export async function advanceStatus(
  pool: Pool,
  orderId: string,
  to: OrderStatus,
): Promise<OrderStatusEvent> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query<OrderRow>(
      'SELECT customer_id, branch_id, status, version FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    );
    const row = cur.rows[0];
    if (!row) throw new Error(`order ${orderId} not found`);
    assertTransition(row.status, to); // illegal transitions rejected server-side
    const version = row.version + 1;
    await client.query('UPDATE orders SET status = $2, version = $3 WHERE id = $1', [
      orderId,
      to,
      version,
    ]);
    // Parse-to-brand + validate the wire shape at the boundary (ids come from the DB as strings).
    const event: OrderStatusEvent = OrderStatusEventSchema.parse({
      orderId,
      status: to,
      version,
      branchId: row.branch_id,
      occurredAt: new Date().toISOString(),
    });
    // Delivered only if this transaction commits.
    await client.query('SELECT pg_notify($1, $2)', [orderChannelName(orderId), JSON.stringify(event)]);
    await client.query('COMMIT');
    return event;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Client mirror of the mobile subscriber: subscribes to channel-per-order, applies pushes
 * to a local cache ONLY if `version` advances (drops stale/replayed events), and on
 * reconnect fires exactly one authoritative refetch (never a manual refresh on a push).
 */
export class OrderRealtimeClient {
  private listenClient: PgClient | null = null;
  private readonly cache = new Map<string, OrderState>();
  /** How many authoritative REST-style refetches were issued (asserted in tests). */
  public refetchCount = 0;

  constructor(
    private readonly config: DbConfig,
    private readonly pool: Pool,
    private readonly customerId: string,
  ) {}

  get(orderId: string): OrderState | undefined {
    return this.cache.get(orderId);
  }

  private applyEvent(ev: OrderStatusEvent): void {
    const cur = this.cache.get(ev.orderId);
    if (!cur || ev.version > cur.version) {
      this.cache.set(ev.orderId, {
        status: ev.status,
        version: ev.version,
        branchId: ev.branchId,
        customerId: this.customerId,
      });
    }
  }

  private applyAuthoritative(orderId: string, s: OrderState): void {
    const cur = this.cache.get(orderId);
    if (!cur || s.version >= cur.version) this.cache.set(orderId, s);
  }

  /** Owner-scoped subscribe: refuses to LISTEN on someone else's order (negative authz). */
  async subscribe(orderId: string): Promise<'ok' | 'forbidden' | 'not_found'> {
    const auth = await getOrder(this.pool, orderId, this.customerId);
    if (auth === 'forbidden' || auth === 'not_found') return auth;
    this.applyAuthoritative(orderId, auth); // seed cache (not counted as a refetch)
    await this.openChannel(orderId);
    return 'ok';
  }

  private async openChannel(orderId: string): Promise<void> {
    const c = new PgClient(this.config);
    await c.connect();
    c.on('notification', (msg) => {
      if (!msg.payload) return;
      try {
        const parsed = OrderStatusEventSchema.safeParse(JSON.parse(msg.payload));
        if (parsed.success) this.applyEvent(parsed.data);
      } catch {
        /* ignore malformed payloads — realtime is best-effort */
      }
    });
    await c.query(`LISTEN "${orderChannelName(orderId)}"`);
    this.listenClient = c;
  }

  /** Authoritative refetch (TanStack Query refetch). Converges the cache to server truth. */
  async refetch(orderId: string): Promise<void> {
    this.refetchCount += 1;
    const res = await getOrder(this.pool, orderId, this.customerId);
    if (res !== 'forbidden' && res !== 'not_found') this.applyAuthoritative(orderId, res);
  }

  /** Simulate a dropped socket. */
  async disconnect(): Promise<void> {
    await this.listenClient?.end();
    this.listenClient = null;
  }

  /** On reconnect: re-open the channel, then refetch authoritative state exactly once. */
  async reconnect(orderId: string): Promise<void> {
    await this.openChannel(orderId);
    await this.refetch(orderId);
  }

  /** Poll the cache until it reaches `version` (or time out). Returns ms elapsed. */
  async waitForVersion(orderId: string, version: number, timeoutMs = 2000): Promise<number> {
    const start = Date.now();
    for (;;) {
      const cur = this.cache.get(orderId);
      if (cur && cur.version >= version) return Date.now() - start;
      if (Date.now() - start > timeoutMs) {
        throw new Error(`timed out waiting for ${orderId} v${version} (have v${cur?.version ?? 'none'})`);
      }
      await new Promise((r) => setTimeout(r, 2));
    }
  }

  async close(): Promise<void> {
    await this.disconnect();
  }
}
