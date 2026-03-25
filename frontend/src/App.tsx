import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { authApi } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/authStore';

let hasBootstrappedAuth = false;

export default function App() {
  const { user, hasHydrated, setAccessToken, setAuth, logout, setLoading } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    // React StrictMode mounts components twice in development.
    // Gate bootstrap to one refresh attempt per full page load.
    if (hasBootstrappedAuth) {
      return;
    }
    hasBootstrappedAuth = true;

    const bootstrapAuth = async (): Promise<void> => {
      try {
        const refreshRes = await authApi.refreshToken();
        const nextAccessToken = refreshRes.data.data.accessToken;
        setAccessToken(nextAccessToken);

        // /auth/me requires Bearer token, so this call goes through authenticate middleware.
        const meRes = await authApi.getMe();
        setAuth(meRes.data.data.user, nextAccessToken);
      } catch {
        // Keep anonymous users on public routes without forcing logout noise.
        if (user) {
          logout();
        }
      } finally {
        setLoading(false);
      }
    };

    void bootstrapAuth();
  }, [hasHydrated, user, setAccessToken, setAuth, logout, setLoading]);

  return <Outlet />;
}

