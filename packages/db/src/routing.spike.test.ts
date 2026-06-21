import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { GeoJsonPolygon } from '@hyper/shared';
import { startTestDb, type TestDb } from './harness';
import { ROUTING_DDL, resolveZone } from './routing';

let db: TestDb;

// Fixed ids so assertions are deterministic.
const BRANCH_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const BRANCH_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const BRANCH_C = 'cccccccc-0000-0000-0000-000000000003';
const BRANCH_D = 'dddddddd-0000-0000-0000-000000000004';
const ZONE_A = 'a0000000-0000-0000-0000-0000000000a1';
const ZONE_B = 'b0000000-0000-0000-0000-0000000000b2';
const ZONE_C = 'c0000000-0000-0000-0000-0000000000c3';
const ZONE_D = 'd0000000-0000-0000-0000-0000000000d4';

/** Axis-aligned square as a closed GeoJSON ring ([lng, lat]). */
const square = (latMin: number, latMax: number, lngMin: number, lngMax: number): GeoJsonPolygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [lngMin, latMin],
      [lngMax, latMin],
      [lngMax, latMax],
      [lngMin, latMax],
      [lngMin, latMin],
    ],
  ],
});

beforeAll(async () => {
  db = await startTestDb({ port: 54332, maxConnections: 10 });
  await db.pool.query(ROUTING_DDL);

  const branch = (id: string, name: string, lat: number, lng: number) =>
    db.pool.query('INSERT INTO branches (id, name, lat, lng) VALUES ($1,$2,$3,$4)', [id, name, lat, lng]);
  const zone = (id: string, branchId: string, priority: number, poly: GeoJsonPolygon) =>
    db.pool.query('INSERT INTO delivery_zones (id, branch_id, priority, polygon) VALUES ($1,$2,$3,$4)', [
      id,
      branchId,
      priority,
      JSON.stringify(poly),
    ]);

  await branch(BRANCH_A, 'A', 30.0, 31.0);
  await branch(BRANCH_B, 'B', 30.05, 31.05);
  await branch(BRANCH_C, 'C', 30.5, 31.5);
  await branch(BRANCH_D, 'D', 30.55, 31.55);

  // A isolated-ish (priority 1); B overlaps A's NE corner but with higher priority 5.
  await zone(ZONE_A, BRANCH_A, 1, square(30.0, 30.1, 31.0, 31.1));
  await zone(ZONE_B, BRANCH_B, 5, square(30.04, 30.2, 31.04, 31.2));
  // C and D cover the SAME square at EQUAL priority 3 → tie broken by nearer branch.
  await zone(ZONE_C, BRANCH_C, 3, square(30.5, 30.7, 31.5, 31.7));
  await zone(ZONE_D, BRANCH_D, 3, square(30.5, 30.7, 31.5, 31.7));
});

afterAll(async () => {
  await db?.stop();
});

describe('S2 — address → branch zone resolution', () => {
  it('a point inside exactly one zone resolves to that branch', async () => {
    const res = await resolveZone(db.pool, { lat: 30.02, lng: 31.02 }); // only in A
    expect(res.status).toBe('in_zone');
    if (res.status === 'in_zone') expect(res.branchId).toBe(BRANCH_A);
  });

  it('overlap with differing priority resolves to the higher-priority branch', async () => {
    const res = await resolveZone(db.pool, { lat: 30.06, lng: 31.06 }); // in A(1) and B(5)
    expect(res.status).toBe('in_zone');
    if (res.status === 'in_zone') {
      expect(res.branchId).toBe(BRANCH_B);
      expect(res.priority).toBe(5);
    }
  });

  it('overlap with equal priority resolves to the nearer branch', async () => {
    const point = { lat: 30.6, lng: 31.6 }; // in C and D (equal priority 3); D is nearer
    const res = await resolveZone(db.pool, point);
    expect(res.status).toBe('in_zone');
    if (res.status === 'in_zone') {
      expect(res.branchId).toBe(BRANCH_D);
      expect(res.distanceMeters).toBeGreaterThan(0);
    }
  });

  it('a point outside all zones is rejected (we don\'t deliver here yet)', async () => {
    const res = await resolveZone(db.pool, { lat: 29.0, lng: 30.0 });
    expect(res).toEqual({ status: 'not_deliverable', reason: 'outside_all_zones' });
  });

  it('is deterministic across repeated runs', async () => {
    const a = await resolveZone(db.pool, { lat: 30.06, lng: 31.06 });
    const b = await resolveZone(db.pool, { lat: 30.06, lng: 31.06 });
    expect(a).toEqual(b);
  });
});
