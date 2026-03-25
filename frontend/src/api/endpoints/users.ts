import client from '@/api/client';
import type { InviteUserDto, UpdateUserDto } from '@/types';

export const usersApi = {
  list: (params?: Record<string, string | number | undefined> | URLSearchParams) => client.get('/users', { params }),
  getOne: (userId: string) => client.get(`/users/${userId}`),
  invite: (data: InviteUserDto) => client.post('/users', data),
  update: (userId: string, data: UpdateUserDto) => client.patch(`/users/${userId}`, data),
  deactivate: (userId: string) => client.delete(`/users/${userId}`),
  reactivate: (userId: string) => client.post(`/users/${userId}/reactivate`),
  getMyProfile: () => client.get('/users/me'),
  updateMyProfile: (data: { name: string }) => client.patch('/users/me', data)
};
