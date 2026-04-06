import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './reports.service';
import type { StockValuationQuery, MovementsQuery, LowStockQuery, WasteAdjustmentsQuery } from './reports.schema';

export const stockValuation = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const data = await service.getStockValuation(req.tenantId, req.query as unknown as StockValuationQuery);
  res.status(200).json({ success: true, data });
});

export const stockValuationExport = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  // Streaming endpoint — service writes directly to res
  await service.streamStockValuationCSV(req.tenantId, req.query as unknown as StockValuationQuery, res);
});

export const movements = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const data = await service.getMovementsReport(req.tenantId, req.query as unknown as MovementsQuery);
  res.status(200).json({ success: true, data });
});

export const movementsExport = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  // Streaming endpoint — service writes directly to res
  await service.streamMovementsCSV(req.tenantId, req.query as unknown as MovementsQuery, res);
});

export const lowStock = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const data = await service.getLowStockReport(req.tenantId, req.query as unknown as LowStockQuery);
  res.status(200).json({ success: true, data });
});

export const lowStockExport = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  // Streaming endpoint — service writes directly to res
  await service.streamLowStockCSV(req.tenantId, req.query as unknown as LowStockQuery, res);
});

export const wasteAdjustments = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const data = await service.getWasteAdjustmentsReport(req.tenantId, req.query as unknown as WasteAdjustmentsQuery);
  res.status(200).json({ success: true, data });
});

export const wasteAdjustmentsExport = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  // Streaming endpoint — service writes directly to res
  await service.streamWasteAdjustmentsCSV(req.tenantId, req.query as unknown as WasteAdjustmentsQuery, res);
});
