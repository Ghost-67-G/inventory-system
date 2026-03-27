import client from '@/api/client';
import type { CreateCategoryDto, UpdateCategoryDto } from '@/types';

export const categoriesApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    client.get('/categories', { params }),
  dropdown: () => client.get('/categories/dropdown'),
  getOne: (id: string) => client.get(`/categories/${id}`),
  create: (data: CreateCategoryDto) => client.post('/categories', data),
  update: (id: string, data: UpdateCategoryDto) => client.patch(`/categories/${id}`, data),
  delete: (id: string) => client.delete(`/categories/${id}`)
};
