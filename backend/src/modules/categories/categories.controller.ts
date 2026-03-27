import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './categories.service';

export const list = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const result = await service.listCategories(req.tenantId, {
    search: req.query.search as string | undefined,
    isActive: req.query.isActive as 'true' | 'false' | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined
  });

  res.status(200).json({ success: true, data: result });
});

export const dropdown = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const categories = await service.getCategoriesForDropdown(req.tenantId);
  res.status(200).json({ success: true, data: { categories } });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const category = await service.getCategory(req.tenantId, req.params.categoryId);
  res.status(200).json({ success: true, data: { category } });
});

export const create = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(400, 'tenantId missing');

  const category = await service.createCategory(req.tenantId, req.user.id, req.body);
  res.status(201).json({ success: true, data: { category } });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const category = await service.updateCategory(req.tenantId, req.params.categoryId, req.body);
  res.status(200).json({ success: true, data: { category } });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  await service.deleteCategory(req.tenantId, req.params.categoryId);
  res.status(200).json({ success: true, message: 'Category deleted' });
});
