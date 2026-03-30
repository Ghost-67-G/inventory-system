import client from '@/api/client';
import type { DashboardStats, IStockMovement } from '@/types';

export const dashboardApi = {
  getStats: () => client.get<{ data: DashboardStats }>('/dashboard/stats'),

  getActivity: () =>
    client.get<{ data: { movements: IStockMovement[] } }>('/dashboard/activity')
};
