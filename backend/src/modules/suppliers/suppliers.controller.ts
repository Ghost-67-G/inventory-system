import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as service from './suppliers.service';

export const list = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');

  const data = await service.listSuppliers(req.tenantId, {
    search: req.query.search as string | undefined,
    isActive: req.query.isActive as 'true' | 'false' | undefined,
    cursor: req.query.cursor as string | undefined,
    limit: Number(req.query.limit ?? 20)
  });

  res.status(200).json({ success: true, data });
});

export const dropdown = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');
  const data = await service.getSuppliersDropdown(req.tenantId);
  res.status(200).json({ success: true, data });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');
  const data = await service.getSupplier(req.tenantId, req.params.supplierId);
  res.status(200).json({ success: true, data });
});

export const create = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(401, 'Unauthorized');

  const supplier = await service.createSupplier(req.tenantId, req.user.id, req.body, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });

  res.status(201).json({ success: true, data: { supplier } });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(401, 'Unauthorized');

  const supplier = await service.updateSupplier(req.tenantId, req.params.supplierId, req.body, req.user.id, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });

  res.status(200).json({ success: true, data: { supplier } });
});

export const deactivate = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) throw new ApiError(401, 'Unauthorized');

  await service.deactivateSupplier(req.tenantId, req.params.supplierId, req.user.id, {
    performedByName: req.user.name,
    performedByEmail: req.user.email,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });

  res.status(200).json({ success: true, message: 'Supplier deactivated' });
});

export const linkProduct = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');
  const link = await service.linkProductToSupplier(req.tenantId, req.params.supplierId, req.body);
  res.status(201).json({ success: true, data: { link } });
});

export const updateLink = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');
  const link = await service.updateSupplierProduct(req.tenantId, req.params.supplierId, req.params.productId, req.body);
  res.status(200).json({ success: true, data: { link } });
});

export const unlinkProduct = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');
  await service.unlinkProductFromSupplier(req.tenantId, req.params.supplierId, req.params.productId);
  res.status(200).json({ success: true, message: 'Product unlinked' });
});

export const productSuppliers = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');
  const data = await service.getProductSuppliers(req.tenantId, req.params.productId);
  res.status(200).json({ success: true, data });
});

export const supplierProducts = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) throw new ApiError(400, 'tenantId missing');
  const data = await service.getSupplierProducts(req.tenantId, req.params.supplierId);
  res.status(200).json({ success: true, data });
});
