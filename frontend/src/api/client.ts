import axios from 'axios';
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { useTenantStore } from '@/store/tenantStore';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // Critical: sends httpOnly refresh-token cookie
  timeout: 60000
});

// ─── Request Interceptor ──────────────────────────────────────────────────────

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Request-ID'] = crypto.randomUUID();
  return config;
});

// ─── Refresh Token Queue Pattern ──────────────────────────────────────────────

type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void };

let isRefreshing = false;
let failedQueue: QueueEntry[] = [];

function redirectToLoginIfNeeded(): void {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

function processQueue(error: unknown, token: string | null): void {
  for (const entry of failedQueue) {
    if (error) entry.reject(error);
    else entry.resolve(token as string);
  }
  failedQueue = [];
}

// ─── Response Interceptor ─────────────────────────────────────────────────────

client.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    // Don't retry if this IS the refresh call, or already retried
    if (status === 401 && originalRequest?._retry) {
      useAuthStore.getState().logout();
      useTenantStore.getState().clearTenant();
      redirectToLoginIfNeeded();
      return Promise.reject(error);
    }

    if (status === 401 && originalRequest && !originalRequest._retry) {
      const url = originalRequest.url ?? '';
      if (url.includes('/auth/refresh-token')) {
        // Refresh endpoint failures are handled by the caller to avoid redirect loops.
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return client(originalRequest);
        });
      }

      isRefreshing = true;

      try {
        const response = await client.post<{ success: true; data: { accessToken: string } }>(
          '/auth/refresh-token'
        );
        const newToken = response.data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);
        processQueue(null, newToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        useTenantStore.getState().clearTenant();
        redirectToLoginIfNeeded();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;

