import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './warehouses.service';

export const list = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const result = await service.listWarehouses(req.tenantId, {
    isActive: req.query.isActive as 'true' | 'false' | undefined,
    search: req.query.search as string | undefined
  });

  res.status(200).json({ success: true, data: { warehouses: result } });
});

export const summary = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const result = await service.getWarehouseSummary(req.tenantId);
  res.status(200).json({ success: true, data: result });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const warehouse = await service.getWarehouse(req.tenantId, req.params.warehouseId);
  res.status(200).json({ success: true, data: { warehouse } });
});

export const getStock = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const result = await service.getWarehouseStock(req.tenantId, req.params.warehouseId, {
    search: req.query.search as string | undefined,
    lowStock: req.query.lowStock as 'true' | 'false' | undefined,
    cursor: req.query.cursor as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined
  });

  res.status(200).json({ success: true, data: result });
});

export const create = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(400, 'tenantId or userId missing');

  const warehouse = await service.createWarehouse(req.tenantId, req.user.id, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(201).json({ success: true, data: { warehouse } });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(400, 'tenantId missing');

  const warehouse = await service.updateWarehouse(req.tenantId, req.params.warehouseId, req.user.id, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, data: { warehouse } });
});

export const deactivate = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(400, 'tenantId missing');

  await service.deactivateWarehouse(req.tenantId, req.params.warehouseId, req.user.id, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, message: 'Warehouse deactivated' });
});

export const reactivate = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(400, 'tenantId missing');

  const warehouse = await service.reactivateWarehouse(req.tenantId, req.params.warehouseId, req.user.id, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, data: { warehouse } });
});

export const setDefault = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const warehouse = await service.setDefaultWarehouse(req.tenantId, req.params.warehouseId);
  res.status(200).json({ success: true, data: { warehouse } });
});
