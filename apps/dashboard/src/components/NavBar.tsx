import { NavLink } from 'react-router-dom';
import { colors, spacing } from '@hyper/shared';
import { useAuth } from '../auth';

/** Nav items gated by role (same allow-lists as the routes in App.tsx). */
const NAV: { to: string; label: string; allow: string[] }[] = [
  { to: '/orders', label: 'الطلبات', allow: ['branch_operator', 'branch_manager', 'hq_admin'] },
  { to: '/catalog', label: 'الكتالوج', allow: ['branch_manager', 'hq_admin'] },
  { to: '/catalog/admin', label: 'إدارة الكتالوج', allow: ['hq_admin'] },
];

const ROLE_LABEL: Record<string, string> = {
  hq_admin: 'المدير العام',
  branch_manager: 'مدير فرع',
  branch_operator: 'مشغل فرع',
};

/** Role-aware top navigation for the authenticated dashboard. Hidden when logged out. */
export function NavBar() {
  const { actor, logout } = useAuth();
  if (!actor) return null;
  const items = NAV.filter((n) => n.allow.includes(actor.role));

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.lg,
        padding: `${spacing.md}px ${spacing.lg}px`,
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface,
      }}
    >
      <span style={{ fontWeight: 800, color: colors.systemsIndigo, fontSize: 18, marginInlineEnd: spacing.sm }}>
        هايبر
      </span>

      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end
          style={({ isActive }) => ({
            color: isActive ? colors.signalPink : colors.ink,
            fontWeight: isActive ? 700 : 500,
            textDecoration: 'none',
            paddingBottom: 2,
            borderBottom: isActive ? `2px solid ${colors.signalPink}` : '2px solid transparent',
          })}
        >
          {n.label}
        </NavLink>
      ))}

      <span style={{ marginInlineStart: 'auto', color: colors.muted, fontSize: 14 }}>
        {ROLE_LABEL[actor.role] ?? actor.role}
      </span>
      <button
        onClick={logout}
        style={{
          border: `1px solid ${colors.border}`,
          background: 'transparent',
          color: colors.danger,
          borderRadius: 8,
          padding: `${spacing.xs}px ${spacing.md}px`,
          cursor: 'pointer',
        }}
      >
        خروج
      </button>
    </nav>
  );
}
