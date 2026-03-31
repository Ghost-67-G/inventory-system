import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as importService from './import.service';

export const upload = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.user?.id) {
    throw new ApiError(400, 'tenantId or userId missing');
  }

  const activeJob = await importService.getActiveImportJob(req.tenantId);
  if (activeJob) {
    throw new ApiError(409, 'An import is already in progress. Wait for it to complete before starting another.');
  }

  const result = await importService.createImportJob(req.tenantId, req.user.id, req.file);
  res.status(201).json({ success: true, data: result });
});

export const getJob = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const job = await importService.getImportJob(req.tenantId, req.params.jobId);
  res.status(200).json({ success: true, data: { job } });
});

export const listJobs = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const result = await importService.listImportJobs(req.tenantId, {
    cursor: req.query.cursor as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined
  });

  res.status(200).json({ success: true, data: result });
});

export const downloadTemplate = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId missing');
  }

  const csv = await importService.buildTemplateCsv(req.tenantId);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
  res.status(200).send(csv);
});
