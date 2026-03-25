import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SafeUser } from '@/types';

interface AuthState {
  user: SafeUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: SafeUser, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  // Backward-compatible alias
  setSession: (user: SafeUser, accessToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isLoading: false }),

      setAccessToken: (token) =>
        set({ accessToken: token, isAuthenticated: true }),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false }),

      setLoading: (loading) => set({ isLoading: loading }),

      setSession: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isLoading: false })
    }),
    {
      name: 'auth-storage',
      // Only persist user — accessToken is in-memory only (refreshed on mount)
      partialize: (state) => ({ user: state.user })
    }
  )
);

