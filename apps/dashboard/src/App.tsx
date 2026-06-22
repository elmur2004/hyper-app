import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from '@hyper/shared/ui';
import { AuthProvider } from './auth';
import { RoleGate } from './components/RoleGate';
import { NavBar } from './components/NavBar';
import { LoginPage } from './pages/Login';
import { OrdersFirehosePage } from './pages/OrdersFirehose';
import { CatalogPage } from './pages/Catalog';
import { CatalogAdminPage } from './pages/CatalogAdmin';

const queryClient = new QueryClient();

/** Authenticated shell: navbar + the active page. */
function DashboardLayout() {
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider dir="rtl">
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<DashboardLayout />}>
                <Route
                  path="/orders"
                  element={
                    <RoleGate allow={['branch_operator', 'branch_manager', 'hq_admin']}>
                      <OrdersFirehosePage />
                    </RoleGate>
                  }
                />
                <Route
                  path="/catalog"
                  element={
                    <RoleGate allow={['branch_manager', 'hq_admin']}>
                      <CatalogPage />
                    </RoleGate>
                  }
                />
                <Route
                  path="/catalog/admin"
                  element={
                    <RoleGate allow={['hq_admin']}>
                      <CatalogAdminPage />
                    </RoleGate>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/orders" replace />} />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
