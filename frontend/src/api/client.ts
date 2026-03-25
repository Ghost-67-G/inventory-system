import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  const headers = config.headers;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  headers['x-request-id'] = uuidv4();
  return config;
});

const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const response = await api.post<{ success: boolean; data: { accessToken: string } }>('/auth/refresh-token');
    const token = response.data.data.accessToken;
    const { user, setSession } = useAuthStore.getState();
    if (user) {
      setSession(user, token);
    }
    return token;
  } catch {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    return null;
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const nextToken = await refreshPromise;
      if (nextToken && originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
