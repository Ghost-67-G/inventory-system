import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './users.service';

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.role) {
    throw new ApiError(400, 'tenantId missing');
  }

  const result = await service.listUsers(req.tenantId, req.user.role, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    role: req.query.role as import('../../types').Role | undefined,
    isActive: req.query.isActive as 'true' | 'false' | undefined,
    search: req.query.search as string | undefined
  });

  res.status(200).json({ success: true, data: result });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.role) {
    throw new ApiError(400, 'tenantId missing');
  }

  const user = await service.getUser(req.tenantId, req.user.role, req.params.userId);
  res.status(200).json({ success: true, data: { user } });
});

export const invite = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id || !req.user.role) {
    throw new ApiError(400, 'tenantId missing');
  }

  const user = await service.inviteUser(req.tenantId, req.user.id, req.user.role, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(201).json({ success: true, message: 'Invitation sent', data: { user } });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id || !req.user.role) {
    throw new ApiError(400, 'tenantId missing');
  }

  const user = await service.updateUser(req.tenantId, req.user.id, req.user.role, req.params.userId, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, data: { user } });
});

export const deactivate = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id || !req.user.role) {
    throw new ApiError(400, 'tenantId missing');
  }

  await service.deactivateUser(req.tenantId, req.user.id, req.user.role, req.params.userId, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, message: 'User deactivated' });
});

export const reactivate = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id || !req.user.role) {
    throw new ApiError(400, 'tenantId missing');
  }

  const user = await service.reactivateUser(req.tenantId, req.user.id, req.user.role, req.params.userId, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, data: { user } });
});

export const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(400, 'tenantId missing');
  }

  const user = await service.getMyProfile(req.user.id, req.tenantId);
  res.status(200).json({ success: true, data: { user } });
});

export const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(400, 'tenantId missing');
  }

  const user = await service.updateMyProfile(req.user.id, req.tenantId, req.body);
  res.status(200).json({ success: true, data: { user } });
});
