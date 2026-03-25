import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export const AuthGuard = ({ children }: PropsWithChildren) => {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};
