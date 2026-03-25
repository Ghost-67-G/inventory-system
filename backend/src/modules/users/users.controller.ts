import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './users.service';

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const users = await service.listUsers(req.tenantId);
  res.status(200).json({ success: true, data: users });
});
