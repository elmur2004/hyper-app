import { describe, it, expect } from 'vitest';
import { OrderStatusSchema } from '../schemas/orders';
import { tokens, statusColors, colors } from './tokens';
import { cssVars } from './cssVars';

describe('theme tokens', () => {
  it('exposes the required scales', () => {
    for (const scale of ['colors', 'spacing', 'radii', 'fontSizes', 'elevation', 'zIndex'] as const) {
      expect(tokens[scale]).toBeTruthy();
    }
  });

  it('has exactly one status color per OrderStatus (exhaustive)', () => {
    const statuses = OrderStatusSchema.options;
    expect(Object.keys(statusColors).sort()).toEqual([...statuses].sort());
    for (const s of statuses) expect(statusColors[s]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('anchors on Systems Indigo and reserves Signal Pink for CTA/accent', () => {
    expect(colors.systemsIndigo).toBe('#1D267D');
    expect(colors.signalPink).toBe('#FF4F87');
  });
});

describe('cssVars()', () => {
  it('emits well-formed custom properties with a [dir=rtl] block', () => {
    const css = cssVars();
    expect(css).toContain(':root {');
    expect(css).toContain('--color-systems-indigo: #1D267D;');
    expect(css).toMatch(/\[dir="rtl"\]\s*\{/);
    expect(css).toContain('--flow-start: right;'); // RTL flips inline start
  });
});
