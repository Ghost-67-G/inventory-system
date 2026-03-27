import { useMutation, useQuery, useQueryClient, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { warehousesApi } from '@/api/endpoints/warehouses';
import type {
  CreateWarehouseDto,
  IWarehouse,
  UpdateWarehouseDto,
  WarehouseSummary,
  WarehouseStockResponse,
  WarehouseStockParams
} from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export function useWarehouses(params?: { isActive?: 'true' | 'false'; search?: string }) {
  return useQuery({
    queryKey: ['warehouses', params],
    queryFn: async () => {
      const res = await warehousesApi.list(params);
      const payload = res.data as ApiEnvelope<{ warehouses: IWarehouse[] }>;
      return payload.data.warehouses;
    },
    staleTime: 2 * 60 * 1000
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: ['warehouses', id],
    queryFn: async () => {
      const res = await warehousesApi.getOne(id);
      const payload = res.data as ApiEnvelope<{ warehouse: IWarehouse }>;
      return payload.data.warehouse;
    },
    enabled: Boolean(id),
    staleTime: 2 * 60 * 1000
  });
}

export function useWarehouseStock(id: string, params?: WarehouseStockParams) {
  return useInfiniteQuery<
    WarehouseStockResponse,
    Error,
    InfiniteData<WarehouseStockResponse, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: ['warehouses', id, 'stock', params],
    queryFn: async ({ pageParam }) => {
      const res = await warehousesApi.getStock(id, {
        ...params,
        cursor: pageParam
      });
      const payload = res.data as ApiEnvelope<WarehouseStockResponse>;
      return payload.data;
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    initialPageParam: undefined,
    enabled: Boolean(id),
    staleTime: 30 * 1000
  });
}

export function useWarehouseSummary() {
  return useQuery({
    queryKey: ['warehouses', 'summary'],
    queryFn: async () => {
      const res = await warehousesApi.summary();
      const payload = res.data as ApiEnvelope<WarehouseSummary>;
      return payload.data;
    },
    staleTime: 5 * 60 * 1000
  });
}

export function useWarehousesDropdown() {
  return useQuery({
    queryKey: ['warehouses', 'dropdown'],
    queryFn: async () => {
      const res = await warehousesApi.list({ isActive: 'true' });
      const payload = res.data as ApiEnvelope<{ warehouses: IWarehouse[] }>;
      // Return only needed fields: _id, name, code, isDefault
      return payload.data.warehouses.map((w) => ({
        _id: w._id,
        name: w.name,
        code: w.code,
        isDefault: w.isDefault
      }));
    },
    staleTime: 5 * 60 * 1000
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, CreateWarehouseDto>({
    mutationFn: (data) => warehousesApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse created');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to create warehouse');
        return;
      }
      toast.error('Failed to create warehouse');
    }
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, { id: string; data: UpdateWarehouseDto }>({
    mutationFn: ({ id, data }) => warehousesApi.update(id, data),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      void queryClient.invalidateQueries({ queryKey: ['warehouses', id] });
      toast.success('Warehouse updated');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to update warehouse');
        return;
      }
      toast.error('Failed to update warehouse');
    }
  });
}

export function useDeactivateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, string>({
    mutationFn: (id) => warehousesApi.deactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse deactivated');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to deactivate warehouse');
        return;
      }
      toast.error('Failed to deactivate warehouse');
    }
  });
}

export function useReactivateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, string>({
    mutationFn: (id) => warehousesApi.reactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse reactivated');
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to reactivate warehouse');
        return;
      }
      toast.error('Failed to reactivate warehouse');
    }
  });
}

export function useSetDefaultWarehouse() {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, { id: string; name: string }>({
    mutationFn: ({ id }) => warehousesApi.setDefault(id),
    onSuccess: (_data, { name }) => {
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success(`${name} is now the default warehouse`);
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        toast.error(message ?? 'Failed to set default warehouse');
        return;
      }
      toast.error('Failed to set default warehouse');
    }
  });
}
