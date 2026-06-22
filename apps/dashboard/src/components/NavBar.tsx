import { NavLink } from 'react-router-dom';
import { LayoutGrid, LogOut, Package, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth';

/** Nav items gated by role (same allow-lists as the routes in App.tsx). */
const NAV = [
  { to: '/orders', label: 'الطلبات', icon: ShoppingBag, allow: ['branch_operator', 'branch_manager', 'hq_admin'] },
  { to: '/catalog', label: 'الكتالوج', icon: LayoutGrid, allow: ['branch_manager', 'hq_admin'] },
  { to: '/catalog/admin', label: 'إدارة الكتالوج', icon: Package, allow: ['hq_admin'] },
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
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-1 px-4 md:px-8">
        <div className="me-4 flex items-center gap-2 font-extrabold text-primary">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">ه</span>
          <span className="text-lg">هايبر</span>
        </div>

        <nav className="flex items-center gap-1">
          {items.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {n.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-3">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {ROLE_LABEL[actor.role] ?? actor.role}
          </Badge>
          <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hover:text-destructive">
            <LogOut className="size-4" />
            خروج
          </Button>
        </div>
      </div>
    </header>
  );
}
