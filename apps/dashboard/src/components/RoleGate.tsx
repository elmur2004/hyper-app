import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

/** RBAC route guard — gates a route by the actor's role (server still enforces authz). */
export function RoleGate({ allow, children }: { allow: string[]; children: ReactNode }) {
  const { actor } = useAuth();
  if (!actor) return <Navigate to="/login" replace />;
  if (!allow.includes(actor.role)) return <div style={{ padding: 24 }}>غير مصرح لك بهذه الصفحة</div>;
  return <>{children}</>;
}
