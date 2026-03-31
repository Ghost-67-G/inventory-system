import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '@/App';
import { AuthGuard } from '@/router/guards/AuthGuard';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { VerifyEmailSentPage } from '@/pages/auth/VerifyEmailSentPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage';
import { AcceptInvitePage } from '@/pages/auth/AcceptInvitePage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { ImportPage } from '@/pages/products/ImportPage';
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';
import { WarehousesPage } from '@/pages/warehouses/WarehousesPage';
import { WarehouseDetailPage } from '@/pages/warehouses/WarehouseDetailPage';
import { StockMovementsPage } from '@/pages/stock/StockMovementsPage';
import { AlertsPage } from '@/pages/stock/AlertsPage';
import { CategoriesPage } from '@/pages/settings/CategoriesPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { UsersPage } from '@/pages/settings/UsersPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { AuditLogPage } from '@/pages/audit/AuditLogPage';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import { useAuthStore } from '@/store/authStore';
import { useTenantStore } from '@/store/tenantStore';
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage';
import { RedirectIfOnboardingIncomplete, RequireOnboarding } from '@/router/guards/OnboardingGuard';

function RoleRedirect() {
  const user = useAuthStore((state) => state.user);
  const onboardingComplete = useTenantStore((state) => state.onboardingComplete);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'owner' && !onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  if (user.role === 'owner' || user.role === 'manager') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/products" replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // Public auth routes
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/verify-email', element: <VerifyEmailPage /> },
          { path: '/verify-email-sent', element: <VerifyEmailSentPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
          { path: '/accept-invite', element: <AcceptInvitePage /> }
        ]
      },
      // Protected routes
      {
        element: <AuthGuard />,
        children: [
          {
            element: <RequireOnboarding />,
            children: [{ path: '/onboarding', element: <OnboardingPage /> }]
          },
          {
            element: <RedirectIfOnboardingIncomplete />,
            children: [
              {
                element: <AppLayout />,
                children: [
                  {
                    path: '/',
                    element: <RoleRedirect />
                  },
                  {
                    path: '/dashboard',
                    element: (
                      <PermissionGuard permission="dashboard.view" fallback={<Navigate to="/products" replace />}>
                        <DashboardPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/products',
                    element: (
                      <PermissionGuard permission="product.view" fallback={<Navigate to="/" replace />}>
                        <ProductsPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/products/import',
                    element: (
                      <PermissionGuard permission="product.create" fallback={<Navigate to="/products" replace />}>
                        <ImportPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/products/:id',
                    element: (
                      <PermissionGuard permission="product.view" fallback={<Navigate to="/" replace />}>
                        <ProductDetailPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/warehouses',
                    element: (
                      <PermissionGuard permission="warehouse.view" fallback={<Navigate to="/" replace />}>
                        <WarehousesPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/warehouses/:id',
                    element: (
                      <PermissionGuard permission="warehouse.view" fallback={<Navigate to="/" replace />}>
                        <WarehouseDetailPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/stock',
                    element: (
                      <PermissionGuard permission="stock.view" fallback={<Navigate to="/" replace />}>
                        <StockMovementsPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/alerts',
                    element: (
                      <PermissionGuard permission="alert.view" fallback={<Navigate to="/" replace />}>
                        <AlertsPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/reports',
                    element: (
                      <PermissionGuard permission="report.view" fallback={<Navigate to="/dashboard" replace />}>
                        <ReportsPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/settings',
                    element: (
                      <PermissionGuard permission="settings.view" fallback={<Navigate to="/" replace />}>
                        <SettingsPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/audit',
                    element: (
                      <PermissionGuard permission="audit.view" fallback={<Navigate to="/dashboard" replace />}>
                        <AuditLogPage />
                      </PermissionGuard>
                    )
                  },
                  { path: '/settings/password', element: <ChangePasswordPage /> },
                  { path: '/settings/security', element: <ChangePasswordPage /> },
                  {
                    path: '/settings/users',
                    element: (
                      <PermissionGuard permission="user.view" fallback={<Navigate to="/" replace />}>
                        <UsersPage />
                      </PermissionGuard>
                    )
                  },
                  {
                    path: '/settings/categories',
                    element: (
                      <PermissionGuard permission="category.view" fallback={<Navigate to="/" replace />}>
                        <CategoriesPage />
                      </PermissionGuard>
                    )
                  }
                ]
              }
            ]
          }
        ]
      },
      // Redirects
      { path: '*', element: <Navigate to="/login" replace /> }
    ]
  }
]);

