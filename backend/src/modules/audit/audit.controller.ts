import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getEntityHistory, listAuditLogs } from './audit.service';

export const list = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const data = await listAuditLogs(req.tenantId, {
    cursor: req.query.cursor as string | undefined,
    limit: req.query.limit as string | undefined,
    entityType: req.query.entityType as
      | 'product'
      | 'category'
      | 'warehouse'
      | 'user'
      | 'stock'
      | 'settings'
      | undefined,
    entityId: req.query.entityId as string | undefined,
    performedBy: req.query.performedBy as string | undefined,
    action: req.query.action as
      | 'product.created'
      | 'product.updated'
      | 'product.deleted'
      | 'category.created'
      | 'category.updated'
      | 'category.deleted'
      | 'warehouse.created'
      | 'warehouse.updated'
      | 'warehouse.deactivated'
      | 'warehouse.reactivated'
      | 'user.invited'
      | 'user.role_changed'
      | 'user.deactivated'
      | 'user.reactivated'
      | 'stock.adjusted'
      | 'settings.updated'
      | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined
  });

  res.status(200).json({ success: true, data });
});

export const entityHistory = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const data = await getEntityHistory(req.tenantId, req.params.type, req.params.id);
  res.status(200).json({ success: true, data });
});