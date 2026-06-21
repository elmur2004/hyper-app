import { type HTMLAttributes, type ReactNode } from 'react';
import { colors, radii, spacing, elevation } from '../theme/tokens';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Card({ header, footer, children, style, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.lg,
        boxShadow: `0 ${elevation.sm}px ${elevation.md}px rgba(11,15,61,0.06)`,
        overflow: 'hidden',
        textAlign: 'start', // logical — RTL-correct
        ...style,
      }}
    >
      {header != null && (
        <div style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}`, fontWeight: 600 }}>
          {header}
        </div>
      )}
      <div style={{ padding: spacing.lg }}>{children}</div>
      {footer != null && (
        <div style={{ padding: spacing.lg, borderTop: `1px solid ${colors.border}` }}>{footer}</div>
      )}
    </div>
  );
}
