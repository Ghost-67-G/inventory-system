import client from '@/api/client';
import type { CreatePODto, ListPOParams, ReceiveItemsDto, UpdatePODto } from '@/types';

export const purchaseOrdersApi = {
  list: (params?: ListPOParams) => client.get('/purchase-orders', { params }),
  stats: () => client.get('/purchase-orders/stats'),
  getOne: (id: string) => client.get(`/purchase-orders/${id}`),
  create: (data: CreatePODto) => client.post('/purchase-orders', data),
  update: (id: string, data: UpdatePODto) => client.patch(`/purchase-orders/${id}`, data),
  send: (id: string, sendEmail = true) => client.post(`/purchase-orders/${id}/send`, { sendEmail }),
  receiveItems: (id: string, data: ReceiveItemsDto) => client.post(`/purchase-orders/${id}/receive`, data),
  cancel: (id: string, reason?: string) => client.post(`/purchase-orders/${id}/cancel`, { reason })
};
