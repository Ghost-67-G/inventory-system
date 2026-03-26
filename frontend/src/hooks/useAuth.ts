import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints/auth';
import { settingsApi } from '@/api/endpoints/settings';
import { useAuthStore } from '@/store/authStore';
import { useTenantStore } from '@/store/tenantStore';
import type { ChangePasswordDto, LoginDto, RegisterDto } from '@/types';

export function useLogin() {
  const { setAuth } = useAuthStore();
  const { setTenant } = useTenantStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: LoginDto) => authApi.login(data),
    onSuccess: async (res) => {
      const { accessToken, user } = res.data.data;
      setAuth(user, accessToken);

      const settingsRes = await settingsApi.get();
      setTenant(settingsRes.data.data.tenant);

      void navigate('/dashboard');
    }
  });
}

export function useRegister() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: RegisterDto) => authApi.register(data),
    onSuccess: () => {
      void navigate('/verify-email-sent');
    }
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const { clearTenant } = useTenantStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      logout();
      clearTenant();
      void navigate('/login');
    }
  });
}

export function useGetMe() {
  const { isAuthenticated, setAuth, accessToken } = useAuthStore();

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await authApi.getMe();
      return res.data.data.user;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    select: (user) => {
      if (accessToken) {
        setAuth(user, accessToken);
      }
      return user;
    }
  });
}

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { setAuth, setAccessToken, logout, setLoading, setSession } = useAuthStore();

  return { user, accessToken, isAuthenticated, isLoading, setAuth, setAccessToken, logout, setLoading, setSession };
}

