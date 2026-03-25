import api from '../client';

export const login = (payload: { email: string; password: string; tenantId?: string }) =>
  api.post('/auth/login', payload);

export const logout = () => api.post('/auth/logout');
