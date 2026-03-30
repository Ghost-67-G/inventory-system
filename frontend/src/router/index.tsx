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
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';
import { WarehousesPage } from '@/pages/warehouses/WarehousesPage';
import { WarehouseDetailPage } from '@/pages/warehouses/WarehouseDetailPage';
import { StockMovementsPage } from '@/pages/stock/StockMovementsPage';
import { AlertsPage } from '@/pages/stock/AlertsPage';
import { CategoriesPage } from '@/pages/settings/CategoriesPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { UsersPage } from '@/pages/settings/UsersPage';
import { PermissionGuard } from '@/router/guards/PermissionGuard';

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
            element: <AppLayout />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              {
                path: '/products',
                element: (
                  <PermissionGuard permission="product.view" fallback={<Navigate to="/dashboard" replace />}>
                    <ProductsPage />
                  </PermissionGuard>
                )
              },
              {
                path: '/products/:id',
                element: (
                  <PermissionGuard permission="product.view" fallback={<Navigate to="/dashboard" replace />}>
                    <ProductDetailPage />
                  </PermissionGuard>
                )
              },
              {
                path: '/warehouses',
                element: (
                  <PermissionGuard permission="warehouse.view" fallback={<Navigate to="/dashboard" replace />}>
                    <WarehousesPage />
                  </PermissionGuard>
                )
              },
              {
                path: '/warehouses/:id',
                element: (
                  <PermissionGuard permission="warehouse.view" fallback={<Navigate to="/dashboard" replace />}>
                    <WarehouseDetailPage />
                  </PermissionGuard>
                )
              },
              {
                path: '/stock',
                element: (
                  <PermissionGuard permission="stock.view" fallback={<Navigate to="/dashboard" replace />}>
                    <StockMovementsPage />
                  </PermissionGuard>
                )
              },
              {
                path: '/alerts',
                element: (
                  <PermissionGuard permission="alert.view" fallback={<Navigate to="/dashboard" replace />}>
                    <AlertsPage />
                  </PermissionGuard>
                )
              },
              {
                path: '/settings',
                element: (
                  <PermissionGuard permission="settings.view" fallback={<Navigate to="/dashboard" replace />}>
                    <SettingsPage />
                  </PermissionGuard>
                )
              },
              { path: '/settings/password', element: <ChangePasswordPage /> },
              { path: '/settings/security', element: <ChangePasswordPage /> },
              {
                path: '/settings/users',
                element: (
                  <PermissionGuard permission="user.view" fallback={<Navigate to="/dashboard" replace />}>
                    <UsersPage />
                  </PermissionGuard>
                )
              },
              {
                path: '/settings/categories',
                element: (
                  <PermissionGuard permission="category.view" fallback={<Navigate to="/dashboard" replace />}>
                    <CategoriesPage />
                  </PermissionGuard>
                )
              }
            ]
          }
        ]
      },
      // Redirects
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '*', element: <Navigate to="/login" replace /> }
    ]
  }
]);

