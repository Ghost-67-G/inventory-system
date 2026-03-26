import type { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import {
  addCustomField,
  completeOnboarding,
  deleteCustomField,
  getTenantSettings,
  reorderCustomFields,
  updateCustomField,
  updateGeneralSettings,
} from './settings.service';
import type { AddCustomFieldBody, ReorderCustomFieldsBody, UpdateCustomFieldBody, UpdateGeneralSettingsBody } from './settings.schema';

export const getSettings = catchAsync(async (req: Request, res: Response) => {
  const tenant = await getTenantSettings(req.tenantId!);
  res.status(200).json({ success: true, data: { tenant } });
});

export const updateSettings = catchAsync(async (req: Request, res: Response) => {
  const tenant = await updateGeneralSettings(req.tenantId!, req.user?.id ?? '', req.body as UpdateGeneralSettingsBody);
  res.status(200).json({ success: true, data: { tenant } });
});

export const addCustomFieldController = catchAsync(async (req: Request, res: Response) => {
  const field = await addCustomField(req.tenantId!, req.body as AddCustomFieldBody);
  res.status(201).json({ success: true, data: { field } });
});

export const updateCustomFieldController = catchAsync(async (req: Request, res: Response) => {
  const { fieldId } = req.params as { fieldId: string };
  const field = await updateCustomField(req.tenantId!, fieldId, req.body as UpdateCustomFieldBody);
  res.status(200).json({ success: true, data: { field } });
});

export const deleteCustomFieldController = catchAsync(async (req: Request, res: Response) => {
  const { fieldId } = req.params as { fieldId: string };
  await deleteCustomField(req.tenantId!, fieldId);
  res.status(200).json({ success: true, message: 'Custom field deleted' });
});

export const reorderCustomFieldsController = catchAsync(async (req: Request, res: Response) => {
  const fields = await reorderCustomFields(req.tenantId!, req.body as ReorderCustomFieldsBody);
  res.status(200).json({ success: true, data: { fields } });
});

export const completeOnboardingController = catchAsync(async (req: Request, res: Response) => {
  await completeOnboarding(req.tenantId!);
  res.status(200).json({ success: true });
});
