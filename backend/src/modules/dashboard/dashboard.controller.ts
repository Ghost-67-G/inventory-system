import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { getDashboardStats, getRecentActivity } from './dashboard.service';

export const getStats = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const stats = await getDashboardStats(req.tenantId);
  res.status(200).json({ success: true, data: stats });
});

export const getActivity = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const movements = await getRecentActivity(req.tenantId);
  res.status(200).json({ success: true, data: { movements } });
});
