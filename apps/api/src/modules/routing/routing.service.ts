import { Injectable } from '@nestjs/common';
import {
  type LatLng,
  type GeoJsonPolygon,
  type ResolveZoneResponse,
  ResolveZoneResponseSchema,
} from '@hyper/shared';
import { PrismaService } from '../../prisma/prisma.service';

// NOTE: small geo math mirrors @hyper/db's S2 spike; consolidate into a shared geomath
// module when the PostGIS host lands (then this becomes ST_Covers/ST_Distance — ADR-0002).
const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pointInPolygon(point: LatLng, polygon: GeoJsonPolygon): boolean {
  const ring = polygon.coordinates[0];
  if (!ring) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i]!;
    const pj = ring[j]!;
    const [xi, yi] = pi;
    const [xj, yj] = pj;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

@Injectable()
export class RoutingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve a delivery point to a branch: containment, priority↓ then distance↑, else reject. */
  async resolve(point: LatLng): Promise<ResolveZoneResponse> {
    const zones = await this.prisma.deliveryZone.findMany({ include: { branch: true } });
    const candidates = zones
      .filter((z) => pointInPolygon(point, z.polygon as unknown as GeoJsonPolygon))
      .map((z) => ({
        zoneId: z.id,
        branchId: z.branchId,
        priority: z.priority,
        distanceMeters: haversineMeters(point, { lat: z.branch.lat, lng: z.branch.lng }),
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
}
