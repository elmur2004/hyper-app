import { z } from 'zod';
import { LatitudeSchema, LongitudeSchema } from './geo';
import { BranchIdSchema, DeliveryZoneIdSchema } from './branches';

/** Address → branch zone resolution contract (spike S2). Single source for mobile/web/server. */
export const ResolveZoneRequestSchema = z.object({
  lat: LatitudeSchema,
  lng: LongitudeSchema,
});
export type ResolveZoneRequest = z.infer<typeof ResolveZoneRequestSchema>;

export const ResolveZoneResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('in_zone'),
    branchId: BranchIdSchema,
    zoneId: DeliveryZoneIdSchema,
    priority: z.number().int(),
    distanceMeters: z.number().nonnegative(),
  }),
  z.object({
    status: z.literal('not_deliverable'),
    reason: z.literal('outside_all_zones'),
  }),
]);
export type ResolveZoneResponse = z.infer<typeof ResolveZoneResponseSchema>;
