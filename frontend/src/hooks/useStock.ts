import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { stockApi } from '@/api/endpoints/stock';
import type {
  ListAlertsParams,
  ListMovementsParams,
  RecordAdjustmentDto,
  RecordInDto,
  RecordOutDto,
  RecordTransferDto,
  RecordWasteDto
} from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export function useMovements(params?: Omit<ListMovementsParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: ['stock', 'movements', params],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const res = await stockApi.listMovements({ ...(params ?? {}), cursor: pageParam });
      const payload = res.data as ApiEnvelope<{ movements: any[]; nextCursor: string | null; hasMore: boolean }>;
      return payload.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    staleTime: 30_000
  });
}

export function useMovement(id: string | null) {
  return useQuery({
    queryKey: ['stock', 'movements', id],
    queryFn: async () => {
      const res = await stockApi.getMovement(id as string);
      const payload = res.data as ApiEnvelope<{ movement: any }>;
      return payload.data.movement;
    },
    enabled: Boolean(id),
    staleTime: 30_000
  });
}

export function useProductStock(productId: string | null) {
  return useQuery({
    queryKey: ['stock', 'product', productId],
    queryFn: async () => {
      const res = await stockApi.getProductStock(productId as string);
      const payload = res.data as ApiEnvelope<{ stock: any[] }>;
      return payload.data.stock;
    },
    enabled: Boolean(productId),
    staleTime: 30_000
  });
}

export function useAlerts(params?: Omit<ListAlertsParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: ['stock', 'alerts', params],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const res = await stockApi.listAlerts({ ...(params ?? {}), cursor: pageParam });
      const payload = res.data as ApiEnvelope<{ alerts: any[]; nextCursor: string | null; hasMore: boolean }>;
      return payload.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    staleTime: 30_000
  });
}

export function usePendingAlertCount() {
  return useQuery({
    queryKey: ['stock', 'alerts', 'count'],
    queryFn: async () => {
      const res = await stockApi.getAlertCount();
      const payload = res.data as ApiEnvelope<{ count: number }>;
      return payload.data.count;
    },
    staleTime: 30_000,
    refetchInterval: 60_000
  });
}

export function useRecordIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordInDto) => stockApi.recordIn(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'movements'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Stock added');
    }
  });
}

export function useRecordOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordOutDto) => stockApi.recordOut(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'movements'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Stock removed');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to remove stock');
    }
  });
}

export function useRecordAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordAdjustmentDto) => stockApi.recordAdjustment(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'movements'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Stock adjusted');
    }
  });
}

export function useRecordWaste() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordWasteDto) => stockApi.recordWaste(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'movements'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Waste recorded');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Failed to record waste');
    }
  });
}

export function useRecordTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordTransferDto) => stockApi.recordTransfer(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'movements'] });
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Transfer complete');
    }
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => stockApi.acknowledgeAlert(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['stock', 'alerts', 'count'] });
      toast.success('Alert acknowledged');
    }
  });
}

export function useBulkAcknowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertIds: string[]) => stockApi.bulkAcknowledge(alertIds),
    onSuccess: async (res) => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['stock', 'alerts', 'count'] });
      const payload = res.data as ApiEnvelope<{ acknowledged: number }>;
      toast.success(`${payload.data.acknowledged} alerts acknowledged`);
    }
  });
}
