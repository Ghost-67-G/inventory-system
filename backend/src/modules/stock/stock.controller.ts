import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './stock.service';

export const recordIn = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const movement = await service.recordIn(req.tenantId, req.user.id, req.body);
  res.status(201).json({ success: true, data: { movement } });
});

export const recordOut = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const movement = await service.recordOut(req.tenantId, req.user.id, req.body);
  res.status(201).json({ success: true, data: { movement } });
});

export const recordAdjustment = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const movement = await service.recordAdjustment(req.tenantId, req.user.id, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(201).json({ success: true, data: { movement } });
});

export const recordWaste = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const movement = await service.recordWaste(req.tenantId, req.user.id, req.body);
  res.status(201).json({ success: true, data: { movement } });
});

export const recordTransfer = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const movements = await service.recordTransfer(req.tenantId, req.user.id, req.body);
  res.status(201).json({ success: true, data: { movements } });
});

export const listMovements = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const data = await service.listMovements(req.tenantId, req.query as any);
  res.status(200).json({ success: true, data });
});

export const getMovement = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const movement = await service.getMovement(req.tenantId, req.params.id);
  res.status(200).json({ success: true, data: { movement } });
});

export const getProductStock = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const stock = await service.getProductStockByWarehouse(req.tenantId, req.params.productId);
  res.status(200).json({ success: true, data: { stock } });
});

export const listAlerts = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const data = await service.listAlerts(req.tenantId, req.query as any);
  res.status(200).json({ success: true, data });
});

export const alertCount = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const count = await service.getPendingAlertCount(req.tenantId);
  res.status(200).json({ success: true, data: { count } });
});

export const acknowledgeAlert = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const alert = await service.acknowledgeAlert(req.tenantId, req.params.id, req.user.id);
  res.status(200).json({ success: true, data: { alert } });
});

export const bulkAcknowledge = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { acknowledged } = await service.bulkAcknowledge(req.tenantId, req.body.alertIds, req.user.id);
  res.status(200).json({ success: true, data: { acknowledged } });
});
