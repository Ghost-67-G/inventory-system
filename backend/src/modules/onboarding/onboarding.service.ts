import { redis } from '../../config/redis';
import { CategoryModel } from '../../models/Category';
import { Product } from '../../models/Product';
import { TenantModel } from '../../models/Tenant';
import { WarehouseModel } from '../../models/Warehouse';
import { enqueueProductUpsert } from '../../queues/jobs/searchSync.job';
import { ApiError } from '../../utils/ApiError';
import { incrementProductCount } from '../categories/categories.service';
import type { StepOneDto, StepThreeDto, StepTwoDto } from './onboarding.schema';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function invalidateTenantCache(tenantId: string): Promise<void> {
  await redis.del(`tenant:${tenantId}`);
  await redis.del(`tenant:settings:${tenantId}`);
}

export async function getOnboardingStatus(tenantId: string, _userId: string): Promise<{
  onboardingComplete: boolean;
  currentStep: 1 | 2 | 3 | 4;
  completedSteps: number[];
  tenant: {
    name: string;
    currency: string;
    timezone: string;
    lowStockThreshold: number;
  };
  hasWarehouse: boolean;
  hasCategory: boolean;
  hasProduct: boolean;
  warehouseName: string | null;
  productName: string | null;
}> {
  const tenant = await TenantModel.findById(tenantId)
    .select('name settings onboardingComplete')
    .lean();

  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  const [warehouse, category, product] = await Promise.all([
    WarehouseModel.findOne({ tenantId }).sort({ createdAt: 1 }).select('name').lean(),
    CategoryModel.findOne({ tenantId }).select('_id').lean(),
    Product.findOne({ tenantId }).sort({ createdAt: 1 }).select('name').lean()
  ]);

  const hasWarehouse = Boolean(warehouse);
  const hasCategory = Boolean(category);
  const hasProduct = Boolean(product);

  let currentStep: 1 | 2 | 3 | 4 = 1;
  if (tenant.onboardingComplete) {
    currentStep = 4;
  } else if (hasWarehouse && hasCategory && hasProduct) {
    currentStep = 4;
  } else if (hasWarehouse && hasCategory) {
    currentStep = 3;
  } else if (hasWarehouse) {
    currentStep = 2;
  }

  const completedSteps: number[] = [1];
  if (hasWarehouse) {
    completedSteps.push(2);
  }
  if (hasCategory && hasProduct) {
    completedSteps.push(3);
  }
  if (tenant.onboardingComplete) {
    completedSteps.push(4);
  }

  return {
    onboardingComplete: tenant.onboardingComplete,
    currentStep,
    completedSteps,
    tenant: {
      name: tenant.name,
      currency: tenant.settings.currency,
      timezone: tenant.settings.timezone,
      lowStockThreshold: tenant.settings.lowStockThreshold
    },
    hasWarehouse,
    hasCategory,
    hasProduct,
    warehouseName: warehouse?.name ?? null,
    productName: product?.name ?? null
  };
}

export async function completeStepOne(tenantId: string, data: StepOneDto) {
  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  tenant.name = data.businessName;
  tenant.settings.currency = data.currency;
  tenant.settings.timezone = data.timezone;
  tenant.settings.lowStockThreshold = data.lowStockThreshold;

  await tenant.save();
  await invalidateTenantCache(tenantId);

  return {
    name: tenant.name,
    currency: tenant.settings.currency,
    timezone: tenant.settings.timezone,
    lowStockThreshold: tenant.settings.lowStockThreshold
  };
}

export async function completeStepTwo(tenantId: string, userId: string, data: StepTwoDto) {
  const existing = await WarehouseModel.findOne({ tenantId });
  if (existing) {
    return existing;
  }

  const code = data.warehouseCode?.trim().toUpperCase() || 'WH-001';

  const warehouse = await WarehouseModel.create({
    tenantId,
    name: data.warehouseName,
    code,
    isDefault: true,
    isActive: true,
    address: {
      city: data.city ?? '',
      country: data.country ?? ''
    },
    createdBy: userId
  });

  return warehouse;
}

export async function completeStepThree(tenantId: string, userId: string, data: StepThreeDto) {
  const tenant = await TenantModel.findById(tenantId).select('settings.lowStockThreshold').lean();
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  const escapedCategoryName = escapeRegex(data.categoryName.trim());
  let category = await CategoryModel.findOne({
    tenantId,
    name: { $regex: `^${escapedCategoryName}$`, $options: 'i' }
  });

  if (!category) {
    category = await CategoryModel.create({
      tenantId,
      name: data.categoryName,
      color: data.categoryColor,
      createdBy: userId
    });
  }

  const skuUpper = data.productSku.trim().toUpperCase();
  const escapedSku = escapeRegex(skuUpper);
  const existingProduct = await Product.findOne({
    tenantId,
    sku: { $regex: `^${escapedSku}$`, $options: 'i' }
  });

  if (existingProduct) {
    throw new ApiError(409, `SKU '${skuUpper}' already exists`);
  }

  const product = await Product.create({
    tenantId,
    sku: skuUpper,
    name: data.productName,
    categoryId: category._id,
    unit: data.productUnit,
    costPrice: data.productCostPrice,
    sellingPrice: data.productSellingPrice,
    lowStockThreshold: tenant.settings.lowStockThreshold,
    totalStock: 0,
    isActive: true,
    createdBy: userId,
    updatedBy: userId
  });

  await incrementProductCount(tenantId, String(category._id), 1);
  void enqueueProductUpsert(String(product._id), tenantId).catch(() => undefined);

  return { category, product };
}

export async function completeOnboarding(tenantId: string): Promise<{ onboardingComplete: true }> {
  const tenant = await TenantModel.findByIdAndUpdate(tenantId, { onboardingComplete: true }, { new: true });
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  await invalidateTenantCache(tenantId);
  return { onboardingComplete: true };
}

export async function skipOnboarding(tenantId: string): Promise<{ onboardingComplete: true }> {
  return completeOnboarding(tenantId);
}

export async function resetOnboarding(tenantId: string): Promise<{ onboardingComplete: false }> {
  const tenant = await TenantModel.findByIdAndUpdate(tenantId, { onboardingComplete: false }, { new: true });
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  await invalidateTenantCache(tenantId);
  return { onboardingComplete: false };
}
