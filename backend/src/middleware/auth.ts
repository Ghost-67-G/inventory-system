import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(new ApiError(401, 'Invalid or expired token'));
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    next(new ApiError(401, 'Invalid or expired token'));
    return;
  }

  req.user = {
    id: payload.userId,
    tenantId: payload.tenantId,
    role: payload.role as import('../types').Role
  };
  next();
};

// Keep backward-compatible alias used by other modules
export const auth = authenticate;

export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (payload) {
    req.user = {
      id: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role as import('../types').Role
    };
  }
  next();
};
