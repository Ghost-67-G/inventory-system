import type { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import {
  addCustomField,
  completeOnboarding,
  deleteCustomField,
  getNotificationPreferences,
  getTenantSettings,
  reorderCustomFields,
  updateNotificationPreferences,
  updateCustomField,
  updateGeneralSettings,
} from './settings.service';
import type {
  AddCustomFieldBody,
  ReorderCustomFieldsBody,
  UpdateCustomFieldBody,
  UpdateGeneralSettingsBody,
  UpdateNotificationPreferencesBody
} from './settings.schema';

export const getSettings = catchAsync(async (req: Request, res: Response) => {
  const tenant = await getTenantSettings(req.tenantId!);
  res.status(200).json({ success: true, data: { tenant } });
});

export const updateSettings = catchAsync(async (req: Request, res: Response) => {
  const tenant = await updateGeneralSettings(req.tenantId!, req.user?.id ?? '', req.body as UpdateGeneralSettingsBody, {
    performedByName: req.user?.name ?? '',
    performedByEmail: req.user?.email ?? '',
    ipAddress: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null
  });
  res.status(200).json({ success: true, data: { tenant } });
});

export const getNotificationPreferencesController = catchAsync(async (req: Request, res: Response) => {
  const preferences = await getNotificationPreferences(req.tenantId!);
  res.status(200).json({ success: true, data: { preferences } });
});

export const updateNotificationPreferencesController = catchAsync(async (req: Request, res: Response) => {
  const preferences = await updateNotificationPreferences(
    req.tenantId!,
    req.user?.id ?? '',
    req.body as UpdateNotificationPreferencesBody,
    {
      performedByName: req.user?.name ?? '',
      performedByEmail: req.user?.email ?? '',
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null
    }
  );

  res.status(200).json({ success: true, data: { preferences } });
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
