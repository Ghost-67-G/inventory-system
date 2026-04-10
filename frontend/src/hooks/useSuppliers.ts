import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { suppliersApi } from '@/api/endpoints/suppliers';
import type {
  CreateSupplierDto,
  ISupplier,
  ISupplierDropdownItem,
  ISupplierProduct,
  ListSuppliersParams,
  UpdateSupplierDto
} from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface SupplierListResponse {
  suppliers: ISupplier[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function useSuppliers(params?: ListSuppliersParams) {
  return useInfiniteQuery({
    queryKey: ['suppliers', params],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const res = await suppliersApi.list({ ...params, cursor: pageParam });
      const payload = res.data as ApiEnvelope<SupplierListResponse>;
      return payload.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined
  });
}

export function useSuppliersDropdown() {
  return useQuery({
    queryKey: ['suppliers', 'dropdown'],
    queryFn: async () => {
      const res = await suppliersApi.dropdown();
      const payload = res.data as ApiEnvelope<{ suppliers: ISupplierDropdownItem[] }>;
      return payload.data.suppliers;
    },
    staleTime: 5 * 60_000
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      const res = await suppliersApi.getOne(id);
      const payload = res.data as ApiEnvelope<{ supplier: ISupplier; recentPOs: unknown[] }>;
      return payload.data;
    },
    enabled: Boolean(id)
  });
}

export function useProductSuppliers(productId: string) {
  return useQuery({
    queryKey: ['suppliers', 'product', productId],
    queryFn: async () => {
      const res = await suppliersApi.getProductSuppliers(productId);
      const payload = res.data as ApiEnvelope<{ suppliers: ISupplierProduct[] }>;
      return payload.data.suppliers;
    },
    enabled: Boolean(productId)
  });
}

export function useSupplierProducts(supplierId: string) {
  return useQuery({
    queryKey: ['suppliers', supplierId, 'products'],
    queryFn: async () => {
      const res = await suppliersApi.supplierProducts(supplierId);
      const payload = res.data as ApiEnvelope<{ links: ISupplierProduct[] }>;
      return payload.data.links;
    },
    enabled: Boolean(supplierId)
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupplierDto) => suppliersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier created');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to create supplier');
    }
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierDto }) => suppliersApi.update(id, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', vars.id] });
      toast.success('Supplier updated');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to update supplier');
    }
  });
}

export function useDeactivateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => suppliersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier deactivated');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to deactivate supplier');
    }
  });
}

export function useLinkProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ supplierId, data }: { supplierId: string; data: any }) => suppliersApi.linkProduct(supplierId, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', vars.supplierId] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'product', vars.data.productId] });
      toast.success('Product linked');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to link product');
    }
  });
}

export function useUpdateSupplierProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ supplierId, productId, data }: { supplierId: string; productId: string; data: any }) =>
      suppliersApi.updateLink(supplierId, productId, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', vars.supplierId] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'product', vars.productId] });
      toast.success('Supplier product updated');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to update supplier product');
    }
  });
}

export function useUnlinkProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ supplierId, productId }: { supplierId: string; productId: string }) =>
      suppliersApi.unlinkProduct(supplierId, productId),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers', vars.supplierId] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'product', vars.productId] });
      toast.success('Product unlinked');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to unlink product');
    }
  });
}
