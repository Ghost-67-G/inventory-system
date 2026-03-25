import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);

  return { user, accessToken, setSession, logout, isAuthenticated: Boolean(accessToken) };
};
