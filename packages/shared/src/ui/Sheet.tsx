import { useEffect, useRef, type ReactNode } from 'react';
import { colors, radii, spacing, zIndex } from '../theme/tokens';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Logical edge: 'start'/'end' flip with RTL; 'bottom' is a bottom sheet. */
  side?: 'start' | 'end' | 'bottom';
  children?: ReactNode;
  title?: string;
}

/** RTL-correct drawer/bottom-sheet with backdrop + ESC close and basic focus handling. */
export function Sheet({ open, onClose, side = 'end', children, title }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panelPosition =
    side === 'bottom'
      ? { insetInline: 0, bottom: 0, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg }
      : side === 'start'
        ? { insetInlineStart: 0, top: 0, bottom: 0, width: 360 }
        : { insetInlineEnd: 0, top: 0, bottom: 0, width: 360 };

  return (
    <div
      data-testid="sheet-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,15,61,0.45)',
        zIndex: zIndex.sheet,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          background: colors.surface,
          boxShadow: '0 12px 32px rgba(11,15,61,0.25)',
          padding: spacing.lg,
          textAlign: 'start',
          ...panelPosition,
        }}
      >
        {title != null && <h2 style={{ marginTop: 0 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
