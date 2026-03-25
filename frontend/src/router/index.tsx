import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';
import { AuthGuard } from './guards/AuthGuard';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { ProductsPage } from '../pages/products/ProductsPage';
import { ProductDetailPage } from '../pages/products/ProductDetailPage';
import { WarehousesPage } from '../pages/warehouses/WarehousesPage';
import { StockMovementsPage } from '../pages/stock/StockMovementsPage';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> }
        ]
      },
      {
        element: (
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        ),
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/products', element: <ProductsPage /> },
          { path: '/products/:id', element: <ProductDetailPage /> },
          { path: '/warehouses', element: <WarehousesPage /> },
          { path: '/stock', element: <StockMovementsPage /> },
          { path: '/alerts', element: <AlertsPage /> },
          { path: '/settings', element: <SettingsPage /> }
        ]
      }
    ]
  }
]);
