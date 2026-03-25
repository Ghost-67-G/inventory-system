import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { authApi } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/authStore';

export default function App() {
  const { user, setAccessToken, logout, setLoading } = useAuthStore();

  useEffect(() => {
    // On mount: if user is persisted in localStorage, try to refresh the access token
    if (!user) {
      setLoading(false);
      return;
    }

    authApi
      .refreshToken()
      .then((res) => {
        setAccessToken(res.data.data.accessToken);
      })
      .catch(() => {
        // Refresh token expired or invalid — clear session
        logout();
      })
      .finally(() => {
        setLoading(false);
      });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Outlet />;
}

