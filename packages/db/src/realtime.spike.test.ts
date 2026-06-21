import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startTestDb, type TestDb } from './harness';
import { ORDERS_DDL, advanceStatus, getOrder, OrderRealtimeClient } from './realtime';

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb({ port: 54331, maxConnections: 20 });
  await db.pool.query(ORDERS_DDL);
});

afterAll(async () => {
  await db?.stop();
});

async function createOrder(customerId: string, branchId: string): Promise<string> {
  const id = randomUUID();
  await db.pool.query(
    `INSERT INTO orders (id, customer_id, branch_id, status, version) VALUES ($1, $2, $3, 'placed', 0)`,
    [id, customerId, branchId],
  );
  return id;
}

describe('S3 — live push (optimization over REST)', () => {
  it('applies a status push to the cache WITHOUT a manual refetch, within the SLA', async () => {
    const customer = randomUUID();
    const branch = randomUUID();
    const orderId = await createOrder(customer, branch);
    const client = new OrderRealtimeClient(db.config, db.pool, customer);
    await client.subscribe(orderId);
    expect(client.get(orderId)).toMatchObject({ status: 'placed', version: 0 });

    await advanceStatus(db.pool, orderId, 'confirmed');
    const elapsed = await client.waitForVersion(orderId, 1);

    expect(client.get(orderId)).toMatchObject({ status: 'confirmed', version: 1 });
    expect(client.refetchCount).toBe(0); // pushed, never refetched
    expect(elapsed).toBeLessThanOrEqual(2000);
    await client.close();
  });

  it('drops stale/replayed events (version dedup)', async () => {
    const customer = randomUUID();
    const orderId = await createOrder(customer, randomUUID());
    const client = new OrderRealtimeClient(db.config, db.pool, customer);
    await client.subscribe(orderId);

    await advanceStatus(db.pool, orderId, 'confirmed'); // v1
    await client.waitForVersion(orderId, 1);

    // Replay an OLD event (v1) directly on the channel; cache must ignore it after moving on.
    await advanceStatus(db.pool, orderId, 'picking'); // v2
    await client.waitForVersion(orderId, 2);
    await db.pool.query('SELECT pg_notify($1, $2)', [
      `order:${orderId}`,
      JSON.stringify({ orderId, status: 'confirmed', version: 1, branchId: randomUUID(), occurredAt: new Date().toISOString() }),
    ]);
    await new Promise((r) => setTimeout(r, 50));

    expect(client.get(orderId)).toMatchObject({ status: 'picking', version: 2 });
    await client.close();
  });
});

describe('S3 — negative authz (channel-per-order isolation)', () => {
  it('a customer cannot subscribe to / read another customer\'s order, and gets none of its events', async () => {
    const custA = randomUUID();
    const custB = randomUUID();
    const orderA = await createOrder(custA, randomUUID());
    const orderB = await createOrder(custB, randomUUID());

    const clientA = new OrderRealtimeClient(db.config, db.pool, custA);
    expect(await clientA.subscribe(orderA)).toBe('ok');
    // A may not subscribe to B's order (data-layer denial, not client-side filtering)
    expect(await clientA.subscribe(orderB)).toBe('forbidden');
    // A may not read B's order
    expect(await getOrder(db.pool, orderB, custA)).toBe('forbidden');

    // Drive both; A must observe only its own order's events.
    await advanceStatus(db.pool, orderA, 'confirmed');
    await advanceStatus(db.pool, orderB, 'confirmed');
    await clientA.waitForVersion(orderA, 1);
    await new Promise((r) => setTimeout(r, 50));

    expect(clientA.get(orderA)).toMatchObject({ status: 'confirmed', version: 1 });
    expect(clientA.get(orderB)).toBeUndefined(); // zero leakage of B
    await clientA.close();
  });
});

describe('S3 — reconnect refetch (always-correct on reconnect)', () => {
  it('kills the socket, transitions offline, reconnects → exactly ONE refetch recovers the missed state', async () => {
    const customer = randomUUID();
    const orderId = await createOrder(customer, randomUUID());
    const client = new OrderRealtimeClient(db.config, db.pool, customer);
    await client.subscribe(orderId);

    await advanceStatus(db.pool, orderId, 'confirmed'); // v1
    await client.waitForVersion(orderId, 1);
    expect(client.refetchCount).toBe(0);

    await client.disconnect();
    await advanceStatus(db.pool, orderId, 'picking'); // v2, missed while offline
    expect(client.get(orderId)).toMatchObject({ version: 1 }); // still stale offline

    await client.reconnect(orderId);
    expect(client.refetchCount).toBe(1); // exactly one authoritative refetch
    expect(client.get(orderId)).toMatchObject({ status: 'picking', version: 2 }); // converged
    await client.close();
  });
});

describe('S3 — SLA latency harness (≥50 transitions)', () => {
  it('p95 push latency ≤ 2000ms over 50 transitions', async () => {
    const latencies: number[] = [];
    for (let i = 0; i < 50; i++) {
      const customer = randomUUID();
      const orderId = await createOrder(customer, randomUUID());
      const client = new OrderRealtimeClient(db.config, db.pool, customer);
      await client.subscribe(orderId);
      await advanceStatus(db.pool, orderId, 'confirmed');
      latencies.push(await client.waitForVersion(orderId, 1));
      await client.close();
    }
    latencies.sort((a, b) => a - b);
    const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]!;
    const p50 = pct(50);
    const p95 = pct(95);
    const p99 = pct(99);
    console.log(`S3 push latency over ${latencies.length} transitions — p50=${p50}ms p95=${p95}ms p99=${p99}ms`);
    expect(p95).toBeLessThanOrEqual(2000);
  });
});
