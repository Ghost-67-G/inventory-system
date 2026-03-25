import type { NextFunction, Request, Response } from 'express';
import { PERMISSIONS, type Permission } from '../types';
import type { Role } from '../types';
import { ApiError } from '../utils/ApiError';

export const requirePermission = (permission: Permission) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Unauthorized'));
      return;
    }

    const allowedRoles = PERMISSIONS[permission] as readonly Role[];
    if (!allowedRoles.includes(req.user.role)) {
      next(new ApiError(403, 'Forbidden'));
      return;
    }

    next();
  };
};
