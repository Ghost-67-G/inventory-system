import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const normalized =
    error instanceof ApiError ? error : new ApiError(500, error instanceof Error ? error.message : 'Internal server error');

  logger.error('request_failed', {
    requestId: req.requestId,
    tenantId: req.tenantId,
    path: req.path,
    method: req.method,
    statusCode: normalized.statusCode,
    message: normalized.message
  });

  res.status(normalized.statusCode).json({
    success: false,
    error: normalized.name,
    message: normalized.message
  });
};
