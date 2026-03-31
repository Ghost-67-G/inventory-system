import { config } from '../../config';
import { CACHE_KEYS, deleteCache, getCache, setCache } from '../../config/redis';
import type { ICustomField, ITenant } from '../../models/Tenant';
import { TenantModel } from '../../models/Tenant';
import { createAuditLog, diffObjects, type AuditContext } from '../../utils/audit';
import { ApiError } from '../../utils/ApiError';
import type {
  AddCustomFieldBody,
  ReorderCustomFieldsBody,
  UpdateCustomFieldBody,
  UpdateGeneralSettingsBody,
  UpdateNotificationPreferencesBody
} from './settings.schema';

const TENANT_SETTINGS_TTL = 60 * 60; // 1 hour

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function generateKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function getTenantSettings(tenantId: string): Promise<ITenant> {
  const cacheKey = CACHE_KEYS.tenantSettings(tenantId);
  const cached = await getCache<ITenant>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  await setCache(cacheKey, tenant.toObject(), TENANT_SETTINGS_TTL);
  return tenant;
}

export async function updateGeneralSettings(
  tenantId: string,
  requesterId: string,
  data: UpdateGeneralSettingsBody,
  auditCtx: AuditContext
): Promise<ITenant> {
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  const oldSettings = JSON.parse(JSON.stringify(tenant.settings));

  if (data.name !== undefined) {
    const newSlug = generateSlug(data.name);
    const conflict = await TenantModel.findOne({ slug: newSlug, _id: { $ne: tenantId } }).lean();
    if (conflict) {
      throw new ApiError(409, 'This business name is already taken');
    }
    tenant.name = data.name;
    tenant.slug = newSlug;
  }

  if (data.settings) {
    if (data.settings.currency !== undefined) tenant.settings.currency = data.settings.currency;
    if (data.settings.timezone !== undefined) tenant.settings.timezone = data.settings.timezone;
    if (data.settings.lowStockThreshold !== undefined) tenant.settings.lowStockThreshold = data.settings.lowStockThreshold;
    if (data.settings.dateFormat !== undefined) tenant.settings.dateFormat = data.settings.dateFormat;
    if (data.settings.measurementUnit !== undefined) tenant.settings.measurementUnit = data.settings.measurementUnit;
  }

  await tenant.save();

  createAuditLog({
    tenantId,
    performedBy: requesterId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'settings.updated',
    entityType: 'settings',
    entityId: tenantId,
    entityName: 'Tenant settings',
    changes: diffObjects(oldSettings as Record<string, unknown>, JSON.parse(JSON.stringify(tenant.settings)) as Record<string, unknown>),
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  await deleteCache(CACHE_KEYS.tenantSettings(tenantId));
  if (config.DEPLOYMENT_MODE === 'self_hosted') {
    await deleteCache(CACHE_KEYS.selfHostedTenantId);
  }

  return tenant;
}

export async function getNotificationPreferences(tenantId: string): Promise<{
  lowStockAlerts: boolean;
  dailySummary: boolean;
  importCompletion: boolean;
}> {
  const tenant = await TenantModel.findById(tenantId).select('settings.emailNotifications').lean();
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  return {
    lowStockAlerts: tenant.settings?.emailNotifications?.lowStockAlerts ?? true,
    dailySummary: tenant.settings?.emailNotifications?.dailySummary ?? false,
    importCompletion: tenant.settings?.emailNotifications?.importCompletion ?? true
  };
}

export async function updateNotificationPreferences(
  tenantId: string,
  requesterId: string,
  data: UpdateNotificationPreferencesBody,
  auditCtx: AuditContext
): Promise<{
  lowStockAlerts: boolean;
  dailySummary: boolean;
  importCompletion: boolean;
}> {
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  const oldSettings = JSON.parse(JSON.stringify(tenant.settings));

  if (!tenant.settings.emailNotifications) {
    tenant.settings.emailNotifications = {
      lowStockAlerts: true,
      dailySummary: false,
      importCompletion: true
    };
  }

  if (data.lowStockAlerts !== undefined) {
    tenant.settings.emailNotifications.lowStockAlerts = data.lowStockAlerts;
  }

  if (data.dailySummary !== undefined) {
    tenant.settings.emailNotifications.dailySummary = data.dailySummary;
  }

  if (data.importCompletion !== undefined) {
    tenant.settings.emailNotifications.importCompletion = data.importCompletion;
  }

  await tenant.save();
  await deleteCache(CACHE_KEYS.tenantSettings(tenantId));

  createAuditLog({
    tenantId,
    performedBy: requesterId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'settings.updated',
    entityType: 'settings',
    entityId: tenantId,
    entityName: 'Tenant settings',
    changes: diffObjects(oldSettings as Record<string, unknown>, JSON.parse(JSON.stringify(tenant.settings)) as Record<string, unknown>),
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return {
    lowStockAlerts: tenant.settings.emailNotifications.lowStockAlerts,
    dailySummary: tenant.settings.emailNotifications.dailySummary,
    importCompletion: tenant.settings.emailNotifications.importCompletion
  };
}

export async function addCustomField(
  tenantId: string,
  data: AddCustomFieldBody
): Promise<ICustomField> {
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  if (tenant.customFields.length >= 20) {
    throw new ApiError(400, 'Maximum of 20 custom fields allowed');
  }

  const key = generateKey(data.name);

  if (tenant.customFields.some(f => f.key === key)) {
    throw new ApiError(409, 'A custom field with this name already exists');
  }

  const newField = {
    name: data.name,
    key,
    type: data.type,
    required: data.required,
    defaultValue: data.defaultValue,
    order: tenant.customFields.length,
  };

  tenant.customFields.push(newField as ICustomField);
  await tenant.save();

  await deleteCache(CACHE_KEYS.tenantSettings(tenantId));

  return tenant.customFields[tenant.customFields.length - 1] as ICustomField;
}

export async function updateCustomField(
  tenantId: string,
  fieldId: string,
  data: UpdateCustomFieldBody
): Promise<ICustomField> {
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  const field = tenant.customFields.id(fieldId);
  if (!field) {
    throw new ApiError(404, 'Custom field not found');
  }

  if (data.name !== undefined) {
    const newKey = generateKey(data.name);
    const conflict = tenant.customFields.some(f => f.key === newKey && f._id.toString() !== fieldId);
    if (conflict) {
      throw new ApiError(409, 'A custom field with this name already exists');
    }
    field.name = data.name;
    // key is immutable — do not update it
  }

  if (data.required !== undefined) field.required = data.required;
  if (data.defaultValue !== undefined) field.defaultValue = data.defaultValue;
  if (data.order !== undefined) field.order = data.order;

  await tenant.save();
  await deleteCache(CACHE_KEYS.tenantSettings(tenantId));

  return field as ICustomField;
}

export async function deleteCustomField(tenantId: string, fieldId: string): Promise<void> {
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  const index = tenant.customFields.findIndex(f => f._id.toString() === fieldId);
  if (index === -1) {
    throw new ApiError(404, 'Custom field not found');
  }

  tenant.customFields.splice(index, 1);

  // Re-number order values to fill the gap
  tenant.customFields.forEach((f, i) => {
    f.order = i;
  });

  await tenant.save();
  await deleteCache(CACHE_KEYS.tenantSettings(tenantId));
}

export async function reorderCustomFields(
  tenantId: string,
  data: ReorderCustomFieldsBody
): Promise<ICustomField[]> {
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  const existingIds = new Set(tenant.customFields.map(f => f._id.toString()));
  for (const { fieldId } of data.fields) {
    if (!existingIds.has(fieldId)) {
      throw new ApiError(400, 'One or more field IDs are invalid');
    }
  }

  for (const { fieldId, order } of data.fields) {
    const field = tenant.customFields.id(fieldId);
    if (field) field.order = order;
  }

  tenant.customFields.sort((a, b) => a.order - b.order);

  await tenant.save();
  await deleteCache(CACHE_KEYS.tenantSettings(tenantId));

  return tenant.customFields as unknown as ICustomField[];
}

export async function completeOnboarding(tenantId: string): Promise<void> {
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  tenant.onboardingComplete = true;
  await tenant.save();
  await deleteCache(CACHE_KEYS.tenantSettings(tenantId));
}
