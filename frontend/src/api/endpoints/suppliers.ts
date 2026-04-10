import client from '@/api/client';
import type { CreateSupplierDto, LinkSupplierProductDto, ListSuppliersParams, UpdateSupplierDto, UpdateSupplierProductDto } from '@/types';

export const suppliersApi = {
  list: (params?: ListSuppliersParams) => client.get('/suppliers', { params }),
  dropdown: () => client.get('/suppliers/dropdown'),
  getOne: (id: string) => client.get(`/suppliers/${id}`),
  create: (data: CreateSupplierDto) => client.post('/suppliers', data),
  update: (id: string, data: UpdateSupplierDto) => client.patch(`/suppliers/${id}`, data),
  deactivate: (id: string) => client.delete(`/suppliers/${id}`),
  supplierProducts: (supplierId: string) => client.get(`/suppliers/${supplierId}/products`),
  linkProduct: (supplierId: string, data: LinkSupplierProductDto) => client.post(`/suppliers/${supplierId}/products`, data),
  updateLink: (supplierId: string, productId: string, data: UpdateSupplierProductDto) =>
    client.patch(`/suppliers/${supplierId}/products/${productId}`, data),
  unlinkProduct: (supplierId: string, productId: string) => client.delete(`/suppliers/${supplierId}/products/${productId}`),
  getProductSuppliers: (productId: string) => client.get(`/suppliers/product/${productId}/suppliers`)
};
