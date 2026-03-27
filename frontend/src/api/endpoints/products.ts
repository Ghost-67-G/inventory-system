import client from '@/api/client';
import type { BulkUpdateDto, CreateProductDto, ListProductsParams, UpdateProductDto } from '@/types';

export const productsApi = {
  list: (params?: ListProductsParams) =>
    client.get('/products', { params }),

  count: (params?: Omit<ListProductsParams, 'cursor' | 'limit'>) =>
    client.get('/products/count', { params }),

  getOne: (id: string) =>
    client.get(`/products/${id}`),

  create: (data: CreateProductDto) =>
    client.post('/products', data),

  update: (id: string, data: UpdateProductDto) =>
    client.patch(`/products/${id}`, data),

  delete: (id: string) =>
    client.delete(`/products/${id}`),

  bulkUpdate: (data: BulkUpdateDto) =>
    client.patch('/products/bulk', data)
};
