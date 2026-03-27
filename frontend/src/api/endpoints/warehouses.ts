import client from '@/api/client';
import type {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseStockParams
} from '@/types';

export const warehousesApi = {
  list: (params?: { isActive?: 'true' | 'false'; search?: string }) =>
    client.get('/warehouses', { params }),

  summary: () =>
    client.get('/warehouses/summary'),

  getOne: (id: string) =>
    client.get(`/warehouses/${id}`),

  getStock: (id: string, params?: WarehouseStockParams) =>
    client.get(`/warehouses/${id}/stock`, { params }),

  create: (data: CreateWarehouseDto) =>
    client.post('/warehouses', data),

  update: (id: string, data: UpdateWarehouseDto) =>
    client.patch(`/warehouses/${id}`, data),

  deactivate: (id: string) =>
    client.delete(`/warehouses/${id}`),

  reactivate: (id: string) =>
    client.post(`/warehouses/${id}/reactivate`),

  setDefault: (id: string) =>
    client.post(`/warehouses/${id}/set-default`)
};
