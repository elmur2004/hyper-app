import { colors, radii, spacing } from '../theme/tokens';

export interface QtyStepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

/** Display-only quantity control (never mutates inventory). Disabled at bounds. */
export function QtyStepper({
  value,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  onChange,
  disabled = false,
}: QtyStepperProps) {
  const atMin = disabled || value <= min;
  const atMax = disabled || value >= max;
  const btn = (enabled: boolean) => ({
    minHeight: 44,
    minWidth: 44,
    borderRadius: radii.md,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.ink,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.5,
    fontSize: 18,
  });
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm }}>
      <button
        type="button"
        aria-label="decrement"
        disabled={atMin}
        onClick={() => onChange(Math.max(min, value - step))}
        style={btn(!atMin)}
      >
        −
      </button>
      <span data-testid="qty-value" style={{ minWidth: 24, textAlign: 'center' }}>
        {value}
      </span>
      <button
        type="button"
        aria-label="increment"
        disabled={atMax}
        onClick={() => onChange(Math.min(max, value + step))}
        style={btn(!atMax)}
      >
        +
      </button>
    </div>
  );
}
