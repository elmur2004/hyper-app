import { describe, it, expect } from 'vitest';
import { LatLngSchema, GeoJsonPolygonSchema } from './geo';

describe('LatLngSchema', () => {
  it('accepts a valid point', () => {
    expect(LatLngSchema.safeParse({ lat: 30.0444, lng: 31.2357 }).success).toBe(true); // Cairo
  });
  it('rejects out-of-range coordinates', () => {
    expect(LatLngSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
    expect(LatLngSchema.safeParse({ lat: 0, lng: 181 }).success).toBe(false);
    expect(LatLngSchema.safeParse({ lat: 'x', lng: 0 }).success).toBe(false);
  });
});

describe('GeoJsonPolygonSchema', () => {
  it('accepts a closed ring of ≥4 positions', () => {
    const square = {
      type: 'Polygon',
      coordinates: [
        [
          [31.2, 30.0],
          [31.3, 30.0],
          [31.3, 30.1],
          [31.2, 30.0],
        ],
      ],
    };
    expect(GeoJsonPolygonSchema.safeParse(square).success).toBe(true);
  });
  it('rejects a ring with too few positions', () => {
    const bad = {
      type: 'Polygon',
      coordinates: [
        [
          [31.2, 30.0],
          [31.3, 30.0],
        ],
      ],
    };
    expect(GeoJsonPolygonSchema.safeParse(bad).success).toBe(false);
  });
});
