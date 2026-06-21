import { type Piastres, formatEgp } from '../schemas/money';
import { colors, fontFamilies } from '../theme/tokens';

export interface PriceProps {
  /** Current price in integer piastres. */
  piastres: Piastres;
  /** Optional original (pre-promo) price; shown struck-through when higher. */
  originalPiastres?: Piastres;
  locale?: string;
}

/** Renders EGP from integer piastres (no float math). Numerics in mono. RTL-safe. */
export function Price({ piastres, originalPiastres, locale = 'ar-EG' }: PriceProps) {
  const hasPromo = originalPiastres != null && originalPiastres > piastres;
  return (
    <span style={{ fontFamily: fontFamilies.mono, display: 'inline-flex', gap: 8, alignItems: 'baseline' }}>
      <span data-testid="price-current" style={{ color: colors.ink, fontWeight: 700 }}>
        {formatEgp(piastres, locale)}
      </span>
      {hasPromo && (
        <span
          data-testid="price-original"
          style={{ color: colors.muted, textDecoration: 'line-through', fontSize: '0.85em' }}
        >
          {formatEgp(originalPiastres, locale)}
        </span>
      )}
    </span>
  );
}
