import { z } from 'zod';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const auditEntityTypeSchema = z.enum(['product', 'category', 'warehouse', 'user', 'stock', 'settings']);

const auditActionSchema = z.enum([
  'product.created',
  'product.updated',
  'product.deleted',
  'category.created',
  'category.updated',
  'category.deleted',
  'warehouse.created',
  'warehouse.updated',
  'warehouse.deactivated',
  'warehouse.reactivated',
  'user.invited',
  'user.role_changed',
  'user.deactivated',
  'user.reactivated',
  'stock.adjusted',
  'settings.updated'
]);

export const listAuditLogsSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    entityType: auditEntityTypeSchema.optional(),
    entityId: mongoId.optional(),
    performedBy: mongoId.optional(),
    action: auditActionSchema.optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional()
  })
});

export const getEntityHistorySchema = z.object({
  params: z.object({
    type: auditEntityTypeSchema,
    id: mongoId
  })
});

export type ListAuditLogsQuery = {
  cursor?: string;
  limit?: string;
  entityType?: z.infer<typeof auditEntityTypeSchema>;
  entityId?: string;
  performedBy?: string;
  action?: z.infer<typeof auditActionSchema>;
  dateFrom?: string;
  dateTo?: string;
};