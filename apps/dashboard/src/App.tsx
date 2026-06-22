import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './auth';
import { RoleGate } from './components/RoleGate';
import { NavBar } from './components/NavBar';
import { LoginPage } from './pages/Login';
import { OrdersFirehosePage } from './pages/OrdersFirehose';
import { CatalogPage } from './pages/Catalog';
import { CatalogAdminPage } from './pages/CatalogAdmin';

const queryClient = new QueryClient();

/** Authenticated shell: navbar + the active page in a centered container. */
function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
      </AuthProvider>
    </QueryClientProvider>
  );
}
