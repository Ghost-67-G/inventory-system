import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './po.service';

export const list = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const data = await service.listPOs(req.tenantId, {
    cursor: req.query.cursor as string | undefined,
    limit: Number(req.query.limit ?? 20),
    status: req.query.status as
      | 'DRAFT'
      | 'SENT'
      | 'PARTIAL'
      | 'RECEIVED'
      | 'CANCELLED'
      | 'OPEN'
      | undefined,
    supplierId: req.query.supplierId as string | undefined,
    warehouseId: req.query.warehouseId as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    search: req.query.search as string | undefined
  });

  res.status(200).json({ success: true, data });
});

export const stats = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const data = await service.getPOStats(req.tenantId);
  res.status(200).json({ success: true, data });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const order = await service.getPO(req.tenantId, req.params.poId);
  res.status(200).json({ success: true, data: { order } });
});

export const create = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(401, 'Unauthorized');

  const order = await service.createPO(req.tenantId, req.user.id, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });

  res.status(201).json({ success: true, data: { order } });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(401, 'Unauthorized');

  const order = await service.updatePO(req.tenantId, req.params.poId, req.user.id, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });

  res.status(200).json({ success: true, data: { order } });
});

export const send = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(401, 'Unauthorized');

  const order = await service.sendPO(req.tenantId, req.params.poId, req.user.id, req.body.sendEmail ?? true, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });

  res.status(200).json({ success: true, data: { order } });
});

export const receive = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(401, 'Unauthorized');

  const data = await service.receiveItems(req.tenantId, req.params.poId, req.user.id, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });

  res.status(200).json({ success: true, data });
});

export const cancel = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(401, 'Unauthorized');

  const order = await service.cancelPO(req.tenantId, req.params.poId, req.user.id, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });

  res.status(200).json({ success: true, data: { order } });
});
