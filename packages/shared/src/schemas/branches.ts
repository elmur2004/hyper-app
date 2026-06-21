import { z } from 'zod';
import { brandedUuid } from './identity';
import { GeoJsonPointSchema, GeoJsonPolygonSchema } from './geo';

export const BranchIdSchema = brandedUuid('BranchId');
export type BranchId = z.infer<typeof BranchIdSchema>;

export const BranchSchema = z.object({
  id: BranchIdSchema,
  name: z.string().min(1),
  location: GeoJsonPointSchema,
  isActive: z.boolean(),
  prepTimeMin: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type Branch = z.infer<typeof BranchSchema>;

export const DeliveryZoneIdSchema = brandedUuid('DeliveryZoneId');
export type DeliveryZoneId = z.infer<typeof DeliveryZoneIdSchema>;

export const DeliveryZoneSchema = z.object({
  id: DeliveryZoneIdSchema,
  branchId: BranchIdSchema,
  polygon: GeoJsonPolygonSchema,
  /** Higher priority wins when zones overlap; ties broken by distance (Plan §11 routing). */
  priority: z.number().int(),
});
export type DeliveryZone = z.infer<typeof DeliveryZoneSchema>;
