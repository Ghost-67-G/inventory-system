import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { auditApi } from '@/api/endpoints/audit';
import { usePermission } from '@/hooks/usePermission';
import type { AuditEntityType, IAuditLog, ListAuditParams } from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export function useAuditLogs(params?: Omit<ListAuditParams, 'cursor'>) {
  const { canDo } = usePermission();

  return useInfiniteQuery({
    queryKey: ['audit', 'logs', params],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const response = await auditApi.list({ ...(params ?? {}), cursor: pageParam });
      const payload = response.data as ApiEnvelope<{ logs: IAuditLog[]; nextCursor: string | null; hasMore: boolean }>;
      return payload.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    staleTime: 30_000,
    enabled: canDo('audit.view')
  });
}

export function useEntityHistory(entityType: AuditEntityType, entityId: string) {
  const { canDo } = usePermission();

  return useQuery({
    queryKey: ['audit', 'entity', entityType, entityId],
    queryFn: async () => {
      const response = await auditApi.entityHistory(entityType, entityId);
      const payload = response.data as ApiEnvelope<{ logs: IAuditLog[] }>;
      return payload.data.logs;
    },
    staleTime: 60_000,
    enabled: Boolean(entityId) && canDo('audit.view')
  });
}
