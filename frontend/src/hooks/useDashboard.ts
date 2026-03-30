import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/endpoints/dashboard';
import type { DashboardStats, IStockMovement } from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const res = await dashboardApi.getStats();
      const payload = res.data as ApiEnvelope<DashboardStats>;
      return payload.data;
    },
    staleTime: 5 * 60_000,
    refetchInterval: false
  });
}

export function useDashboardActivity() {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: async () => {
      const res = await dashboardApi.getActivity();
      const payload = res.data as ApiEnvelope<{ movements: IStockMovement[] }>;
      return payload.data.movements;
    },
    staleTime: 30_000,
    refetchInterval: 60_000
  });
}
