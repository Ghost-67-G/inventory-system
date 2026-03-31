import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './products.service';

export const list = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const result = await service.listProducts(req.tenantId, {
    cursor: req.query.cursor as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    search: req.query.search as string | undefined,
    categoryId: req.query.categoryId as string | undefined,
    isActive: (req.query.isActive as 'true' | 'false' | 'all' | undefined) ?? 'true',
    lowStock: req.query.lowStock as 'true' | undefined,
    sortBy: (req.query.sortBy as 'name' | 'sku' | 'totalStock' | 'createdAt' | undefined) ?? 'createdAt',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc' | undefined) ?? 'desc',
    unit: req.query.unit as string | undefined
  });

  res.status(200).json({ success: true, data: result });
});

export const count = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const filters = {
    isActive: req.query.isActive as 'true' | 'false' | 'all' | undefined,
    categoryId: req.query.categoryId as string | undefined,
    lowStock: req.query.lowStock as 'true' | undefined,
    unit: req.query.unit as string | undefined
  };

  const result = await service.getProductCount(req.tenantId, filters);
  res.status(200).json({ success: true, data: result });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const product = await service.getProduct(req.tenantId, req.params.productId);
  res.status(200).json({ success: true, data: { product } });
});

export const create = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(400, 'tenantId or userId missing');

  const product = await service.createProduct(req.tenantId, req.user.id, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(201).json({ success: true, data: { product } });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(400, 'tenantId or userId missing');

  const product = await service.updateProduct(req.tenantId, req.user.id, req.params.productId, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, data: { product } });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(400, 'tenantId missing');

  await service.deleteProduct(req.tenantId, req.user.id, req.params.productId, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, message: 'Product deleted' });
});

export const bulkUpdate = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(400, 'tenantId or userId missing');

  const result = await service.bulkUpdate(req.tenantId, req.user.id, req.body.productIds, req.body.updates, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, data: result });
});
