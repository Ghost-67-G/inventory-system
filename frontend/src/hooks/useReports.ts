import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/endpoints/reports';
import { usePermission } from './usePermission';
import type {
  StockValuationParams,
  LowStockParams,
  MovementsReportParams,
  WasteAdjustmentsParams
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

/**
 * Stock Valuation Report hook — cursor-based infinite query
 * Cached for 2 minutes
 */
export function useStockValuation(params?: Omit<StockValuationParams, 'cursor'>) {
  const { canDo } = usePermission();

  return useInfiniteQuery({
    queryKey: ['reports', 'stock-valuation', params],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const res = await reportsApi.getStockValuation({ ...params, cursor: pageParam });
      const payload = res.data as ApiEnvelope<{
        rows: any[];
        nextCursor: string | null;
        hasMore: boolean;
        summary?: any;
        generatedAt: string;
      }>;
      return payload.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: canDo('report.view')
  });
}

/**
 * Stock Movements Report hook — cursor-based infinite query
 * Cached for 2 minutes
 */
export function useMovementsReport(params?: MovementsReportParams) {
  const { canDo } = usePermission();

  return useInfiniteQuery({
    queryKey: ['reports', 'movements', params],
    queryFn: async ({ pageParam = null }) => {
      const res = await reportsApi.getMovements({ ...params, cursor: pageParam ?? undefined });
      const payload = res.data as ApiEnvelope<any>;
      return payload.data;
    },
    getNextPageParam: (lastPage: any) => lastPage?.nextCursor,
    initialPageParam: null,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: canDo('report.view')
  });
}

/**
 * Low Stock Report hook
 * Cached for 2 minutes
 */
export function useLowStockReport(params?: LowStockParams) {
  const { canDo } = usePermission();

  return useQuery({
    queryKey: ['reports', 'low-stock', params],
    queryFn: async () => {
      const res = await reportsApi.getLowStock(params);
      const payload = res.data as ApiEnvelope<any>;
      return payload.data;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: canDo('report.view')
  });
}

/**
 * Waste & Adjustments Report hook — cursor-based infinite query
 * Cached for 2 minutes
 */
export function useWasteAdjustmentsReport(params?: WasteAdjustmentsParams) {
  const { canDo } = usePermission();

  return useInfiniteQuery({
    queryKey: ['reports', 'waste-adjustments', params],
    queryFn: async ({ pageParam = null }) => {
      const res = await reportsApi.getWasteAdjustments({ ...params, cursor: pageParam ?? undefined });
      const payload = res.data as ApiEnvelope<any>;
      return payload.data;
    },
    getNextPageParam: (lastPage: any) => lastPage?.nextCursor,
    initialPageParam: null,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: canDo('report.view')
  });
}
