import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useOnboardingStatus } from '@/hooks/useOnboarding';
import { useAuthStore } from '@/store/authStore';
import { useTenantStore } from '@/store/tenantStore';

function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
    </div>
  );
}

export function RequireOnboarding() {
  const user = useAuthStore((state) => state.user);
  const tenant = useTenantStore((state) => state.tenant);
  const statusQuery = useOnboardingStatus();

  if (user?.role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  if (statusQuery.isLoading) {
    return <FullPageSpinner />;
  }

  const onboardingComplete = statusQuery.data?.onboardingComplete ?? tenant?.onboardingComplete ?? false;
  if (onboardingComplete) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function RedirectIfOnboardingIncomplete() {
  const user = useAuthStore((state) => state.user);
  const tenant = useTenantStore((state) => state.tenant);
  const location = useLocation();
  const statusQuery = useOnboardingStatus();

  if (user?.role !== 'owner') {
    return <Outlet />;
  }

  if (location.pathname.startsWith('/settings')) {
    return <Outlet />;
  }

  if (statusQuery.isLoading) {
    return <FullPageSpinner />;
  }

  const onboardingComplete = statusQuery.data?.onboardingComplete ?? tenant?.onboardingComplete ?? false;

  if (!onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
