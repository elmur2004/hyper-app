import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { colors, radii, spacing, fontWeights } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children?: ReactNode;
}

const VARIANT_STYLE: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.systemsIndigo, fg: '#FFFFFF', border: colors.systemsIndigo },
  secondary: { bg: colors.lavenderMist, fg: colors.indigoDeep, border: colors.lavenderMist },
  ghost: { bg: 'transparent', fg: colors.systemsIndigo, border: 'transparent' },
  danger: { bg: colors.signalPink, fg: '#FFFFFF', border: colors.signalPink }, // CTA accent only
};

const SIZE_PAD: Record<ButtonSize, string> = {
  sm: `${spacing.xs}px ${spacing.md}px`,
  md: `${spacing.sm}px ${spacing.lg}px`,
  lg: `${spacing.md}px ${spacing.xl}px`,
};

/** RTL-correct CTA button. ≥44px target, aria-busy/disabled, logical icon placement. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leadingIcon,
  trailingIcon,
  children,
  style,
  ...rest
}: ButtonProps) {
  const v = VARIANT_STYLE[variant];
  const inert = disabled || loading;
  return (
    <button
      {...rest}
      disabled={inert}
      aria-busy={loading}
      aria-disabled={inert}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        minHeight: 44,
        minWidth: 44,
        padding: SIZE_PAD[size],
        borderRadius: radii.md,
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: v.fg,
        fontWeight: Number(fontWeights.semibold),
        cursor: inert ? 'not-allowed' : 'pointer',
        opacity: inert ? 0.6 : 1,
        // logical: children + icons follow inline direction, flips in RTL automatically
        flexDirection: 'row',
        ...style,
      }}
    >
      {loading ? <span aria-hidden="true">…</span> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}
