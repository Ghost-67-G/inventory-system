import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { purchaseOrdersApi } from '@/api/endpoints/purchaseOrders';
import type { CreatePODto, IPurchaseOrder, ListPOParams, POStats, ReceiveItemsDto, UpdatePODto } from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface POListResponse {
  orders: IPurchaseOrder[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function usePurchaseOrders(params?: ListPOParams) {
  return useInfiniteQuery({
    queryKey: ['po', params],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const res = await purchaseOrdersApi.list({ ...params, cursor: pageParam });
      const payload = res.data as ApiEnvelope<POListResponse>;
      return payload.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined
  });
}

export function usePOStats() {
  return useQuery({
    queryKey: ['po', 'stats'],
    queryFn: async () => {
      const res = await purchaseOrdersApi.stats();
      const payload = res.data as ApiEnvelope<POStats>;
      return payload.data;
    },
    staleTime: 5 * 60_000
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['po', id],
    queryFn: async () => {
      const res = await purchaseOrdersApi.getOne(id);
      const payload = res.data as ApiEnvelope<{ order: IPurchaseOrder }>;
      return payload.data.order;
    },
    enabled: Boolean(id)
  });
}

export function useCreatePO() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePODto) => purchaseOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po'] });
      toast.success('Purchase order created');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to create purchase order');
    }
  });
}

export function useUpdatePO() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePODto }) => purchaseOrdersApi.update(id, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['po'] });
      queryClient.invalidateQueries({ queryKey: ['po', vars.id] });
      toast.success('Purchase order updated');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to update purchase order');
    }
  });
}

export function useSendPO() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sendEmail }: { id: string; sendEmail?: boolean }) => purchaseOrdersApi.send(id, sendEmail),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['po'] });
      queryClient.invalidateQueries({ queryKey: ['po', vars.id] });
      toast.success('Order sent to supplier');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to send order');
    }
  });
}

export function useReceiveItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReceiveItemsDto }) => purchaseOrdersApi.receiveItems(id, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['po'] });
      queryClient.invalidateQueries({ queryKey: ['po', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Receipt recorded');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to receive items');
    }
  });
}

export function useCancelPO() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => purchaseOrdersApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po'] });
      toast.success('Purchase order cancelled');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to cancel purchase order');
    }
  });
}
