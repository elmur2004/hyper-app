import { z } from 'zod';

export const LatitudeSchema = z.number().min(-90).max(90);
export const LongitudeSchema = z.number().min(-180).max(180);

/** Human-friendly point (what clients pass at checkout / address pin). */
export const LatLngSchema = z.object({ lat: LatitudeSchema, lng: LongitudeSchema });
export type LatLng = z.infer<typeof LatLngSchema>;

/** GeoJSON position is `[lng, lat]` (note the order). */
export const GeoJsonPositionSchema = z.tuple([LongitudeSchema, LatitudeSchema]);

export const GeoJsonPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: GeoJsonPositionSchema,
});
export type GeoJsonPoint = z.infer<typeof GeoJsonPointSchema>;

/** GeoJSON Polygon: array of linear rings; each ring is a closed loop of ≥4 positions. */
export const GeoJsonPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(GeoJsonPositionSchema).min(4, 'A linear ring needs ≥4 positions')).min(1),
});
export type GeoJsonPolygon = z.infer<typeof GeoJsonPolygonSchema>;
