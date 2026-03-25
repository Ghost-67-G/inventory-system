import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';

export const tenantResolver = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  if (config.DEPLOYMENT_MODE === 'saas') {
    if (!req.user?.tenantId) {
      next(new ApiError(401, 'Tenant not found in token'));
      return;
    }
    req.tenantId = req.user.tenantId;
    next();
    return;
  }

  const TenantModel = mongoose.model('Tenant');
  const tenant = (await TenantModel.findOne({ isActive: true }).select('_id').lean()) as { _id?: unknown } | null;
  if (!tenant?._id) {
    next(new ApiError(500, 'Self-hosted tenant is not configured'));
    return;
  }

  req.tenantId = String(tenant._id);
  next();
};
