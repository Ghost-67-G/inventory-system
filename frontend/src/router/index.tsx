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
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';
import { WarehousesPage } from '@/pages/warehouses/WarehousesPage';
import { StockMovementsPage } from '@/pages/stock/StockMovementsPage';
import { AlertsPage } from '@/pages/alerts/AlertsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

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
          { path: '/reset-password', element: <ResetPasswordPage /> }
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
              { path: '/products', element: <ProductsPage /> },
              { path: '/products/:id', element: <ProductDetailPage /> },
              { path: '/warehouses', element: <WarehousesPage /> },
              { path: '/stock', element: <StockMovementsPage /> },
              { path: '/alerts', element: <AlertsPage /> },
              { path: '/settings', element: <SettingsPage /> },
              { path: '/settings/password', element: <ChangePasswordPage /> }
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

