import client from '@/api/client';
import type { AuditEntityType, IAuditLog, ListAuditParams } from '@/types';

export const auditApi = {
  list: (params?: ListAuditParams) =>
    client.get<{ data: { logs: IAuditLog[]; nextCursor: string | null; hasMore: boolean } }>('/audit', { params }),

  entityHistory: (entityType: AuditEntityType, entityId: string) =>
    client.get<{ data: { logs: IAuditLog[] } }>(`/audit/entity/${entityType}/${entityId}`)
};
