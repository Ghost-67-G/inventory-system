import type { NextFunction, Request, Response } from 'express';
import { hasPermission, type Permission, type Role } from '../types';
import { ApiError } from '../utils/ApiError';

export const requirePermission = (permission: Permission) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Unauthorized'));
      return;
    }

    if (!hasPermission(req.user.role, permission)) {
      next(new ApiError(403, `Forbidden: requires '${permission}' permission`));
      return;
    }

    next();
  };
};

export const requireAnyPermission = (...permissions: Permission[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Unauthorized'));
      return;
    }

    const isAllowed = permissions.some((permission) => hasPermission(req.user!.role, permission));
    if (!isAllowed) {
      next(new ApiError(403, 'Forbidden'));
      return;
    }

    next();
  };
};

export const requireRole = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Unauthorized'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'Forbidden'));
      return;
    }

    next();
  };
};
