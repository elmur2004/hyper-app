import type { Pool } from 'pg';
import {
  type LatLng,
  type GeoJsonPolygon,
  type ResolveZoneResponse,
  ResolveZoneResponseSchema,
} from '@hyper/shared';

/**
 * Spike S2 substrate. Goal: prove the ROUTING LOGIC — point-in-zone containment, overlap
 * tie-break by priority then distance, and rejection outside all zones (Plan §11).
 *
 * embedded-postgres ships without PostGIS, so the spike stores polygons as JSONB and does
 * containment + haversine distance in code. The PRODUCTION mechanism is the documented
 * PostGIS query below (ST_Covers + ST_Distance over GiST indexes) — swapped in once the
 * managed PostGIS host (ADR-0001: Neon/RDS/Crunchy) exists. The request/response contract
 * (packages/shared) and the tie-break order are identical across both.
 */
export const ROUTING_DDL = `
CREATE TABLE IF NOT EXISTS branches (
  id   uuid PRIMARY KEY,
  name text NOT NULL,
  lat  double precision NOT NULL,
  lng  double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_zones (
  id        uuid PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES branches(id),
  priority  integer NOT NULL,
  polygon   jsonb NOT NULL
);
`;

/** The query the production PostGIS host runs instead of the in-code resolver. */
export const PRODUCTION_POSTGIS_RESOLVER = `
-- $1 = lng, $2 = lat. delivery_zones.area geography(Polygon,4326), branches.location
-- geography(Point,4326), both GiST-indexed. Higher priority wins; nearer branch breaks ties.
SELECT z.id AS zone_id, z.branch_id, z.priority,
       ST_Distance(b.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
  FROM delivery_zones z
  JOIN branches b ON b.id = z.branch_id
 WHERE ST_Covers(z.area, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
 ORDER BY z.priority DESC, distance_m ASC, z.id ASC
 LIMIT 1;`;

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ray-casting point-in-polygon over the exterior ring. GeoJSON positions are [lng, lat]. */
export function pointInPolygon(point: LatLng, polygon: GeoJsonPolygon): boolean {
  const ring = polygon.coordinates[0];
  if (!ring) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i]!;
    const pj = ring[j]!;
    const xi = pi[0];
    const yi = pi[1];
    const xj = pj[0];
    const yj = pj[1];
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

interface ZoneRow {
  zone_id: string;
  branch_id: string;
  priority: number;
  polygon: GeoJsonPolygon;
  lat: number;
  lng: number;
}

/**
 * Resolve a delivery point to a branch: among zones whose polygon contains the point,
 * pick the highest priority, breaking ties by nearest branch (then a stable id).
 * Returns `not_deliverable` when no zone contains the point.
 */
export async function resolveZone(pool: Pool, point: LatLng): Promise<ResolveZoneResponse> {
  const { rows } = await pool.query<ZoneRow>(
    `SELECT z.id AS zone_id, z.branch_id, z.priority, z.polygon, b.lat, b.lng
       FROM delivery_zones z
       JOIN branches b ON b.id = z.branch_id`,
  );

  const candidates = rows
    .filter((r) => pointInPolygon(point, r.polygon))
    .map((r) => ({
      zoneId: r.zone_id,
      branchId: r.branch_id,
      priority: r.priority,
      distanceMeters: haversineMeters(point, { lat: r.lat, lng: r.lng }),
    }))
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        a.distanceMeters - b.distanceMeters ||
        a.zoneId.localeCompare(b.zoneId),
    );

  const best = candidates[0];
  if (!best) {
    return ResolveZoneResponseSchema.parse({ status: 'not_deliverable', reason: 'outside_all_zones' });
  }
  return ResolveZoneResponseSchema.parse({
    status: 'in_zone',
    branchId: best.branchId,
    zoneId: best.zoneId,
    priority: best.priority,
    distanceMeters: best.distanceMeters,
  });
}
