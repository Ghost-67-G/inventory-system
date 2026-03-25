import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './warehouses.service';

export const listWarehouses = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const warehouses = await service.listWarehouses(req.tenantId);
  res.status(200).json({ success: true, data: warehouses });
});
