import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './alerts.service';

export const listAlerts = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const alerts = await service.listAlerts(req.tenantId);
  res.status(200).json({ success: true, data: alerts });
});
