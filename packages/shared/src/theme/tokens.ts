import type { OrderStatus } from '../schemas/orders';

/** B-Systems palette (Plan §9). 60/28/12 distribution; Signal Pink punctuates (CTA only). */
export const colors = {
  systemsIndigo: '#1D267D',
  processLavender: '#D4ADFC',
  signalPink: '#FF4F87',
  paper: '#FAFAFD',
  lavenderMist: '#E8D4FE',
  indigoDeep: '#0B0F3D',
  // semantic
  success: '#1E9E6A',
  warning: '#C77700',
  danger: '#D11149',
  info: '#1D267D',
  // neutrals / surfaces
  ink: '#0B0F3D',
  muted: '#6B6F8D',
  border: '#E3E1EE',
  surface: '#FFFFFF',
  background: '#FAFAFD',
} as const;

/** Signature gradient — hero/marketing moments only, never app chrome (Plan §9). */
export const heroGradient =
  'linear-gradient(135deg, #0B0F3D 0%, #1D267D 30%, #4A2A8E 55%, #8B3A95 78%, #FF4F87 100%)';

/**
 * One color per order status. Typed as Record<OrderStatus, …> so adding a status to the
 * enum forces a token here at compile time (StatusPill exhaustiveness, Plan §9 / T0.2.4).
 */
export const statusColors: Record<OrderStatus, string> = {
  placed: colors.muted,
  confirmed: colors.systemsIndigo,
  picking: colors.processLavender,
  packed: colors.lavenderMist,
  out_for_delivery: colors.signalPink,
  delivered: colors.success,
  cancelled: colors.danger,
  refunded: colors.warning,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const fontFamilies = {
  displayLatin: 'Raleway',
  bodyLatin: 'Inter',
  arabic: 'Cairo',
  mono: 'JetBrains Mono',
} as const;
export const fontSizes = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 36 } as const;
export const fontWeights = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;
export const lineHeights = { tight: 1.2, normal: 1.5, relaxed: 1.7 } as const;

export const elevation = { none: 0, sm: 2, md: 6, lg: 12 } as const;
export const zIndex = { base: 0, dropdown: 100, sheet: 200, modal: 300, toast: 400 } as const;

export const tokens = {
  colors,
  statusColors,
  spacing,
  radii,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  elevation,
  zIndex,
} as const;
export type Tokens = typeof tokens;
