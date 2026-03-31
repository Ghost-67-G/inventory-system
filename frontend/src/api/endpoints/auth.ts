import type { ChangePasswordDto, LoginDto, LoginResponse, RefreshResponse, RegisterDto, RegisterResponse, SafeUser } from '@/types';
import client from '@/api/client';

export const authApi = {
  register: (data: RegisterDto) => client.post<RegisterResponse>('/auth/register', data),
  login: (data: LoginDto) => client.post<LoginResponse>('/auth/login', data),
  logout: () => client.post('/auth/logout'),
  logoutAll: () => client.post('/auth/logout-all'),
  refreshToken: () => client.post<RefreshResponse>('/auth/refresh-token'),
  verifyEmail: (token: string) => client.post('/auth/verify-email', { token }),
  forgotPassword: (email: string) => client.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => client.post('/auth/reset-password', { token, password }),
  changePassword: (data: ChangePasswordDto) => client.post('/auth/change-password', data),
  resendVerification: () => client.post('/auth/resend-verification'),
  getMe: () => client.get<{ success: true; data: { user: SafeUser } }>('/auth/me')
};

