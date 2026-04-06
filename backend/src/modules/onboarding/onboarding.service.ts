import { redis } from '../../config/redis';
import { CategoryModel } from '../../models/Category';
import { Product } from '../../models/Product';
import { TenantModel } from '../../models/Tenant';
import { WarehouseModel } from '../../models/Warehouse';
import { enqueueProductUpsert } from '../../queues/jobs/searchSync.job';
import { ApiError } from '../../utils/ApiError';
import { incrementProductCount } from '../categories/categories.service';
import type { StepOneDto, StepThreeDto, StepTwoDto } from './onboarding.schema';

const ONBOARDING_STATUS_TTL_SECONDS = 30;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function invalidateTenantCache(tenantId: string): Promise<void> {
  await redis.del(`tenant:${tenantId}`);
  await redis.del(`tenant:settings:${tenantId}`);
}

async function invalidateOnboardingStatusCache(tenantId: string): Promise<void> {
  await redis.del(`onboarding:status:${tenantId}`);
}

export async function getOnboardingStatus(tenantId: string): Promise<{
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
  const cacheKey = `onboarding:status:${tenantId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as {
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
    };
  }

  const tenant = await TenantModel.findById(tenantId)
    .select('name settings onboardingComplete')
    .lean();

  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  const [warehouseExists, categoryExists, productExists] = await Promise.all([
    WarehouseModel.exists({ tenantId }),
    CategoryModel.exists({ tenantId }),
    Product.exists({ tenantId })
  ]);

  const hasWarehouse = Boolean(warehouseExists);
  const hasCategory = Boolean(categoryExists);
  const hasProduct = Boolean(productExists);

  const [warehouse, product] = await Promise.all([
    hasWarehouse ? WarehouseModel.findOne({ tenantId }).select('name').lean() : Promise.resolve(null),
    hasProduct ? Product.findOne({ tenantId }).select('name').lean() : Promise.resolve(null)
  ]);

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

  const response = {
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

  await redis.set(cacheKey, JSON.stringify(response), 'EX', ONBOARDING_STATUS_TTL_SECONDS);
  return response;
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
  await invalidateOnboardingStatusCache(tenantId);

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

  await invalidateOnboardingStatusCache(tenantId);
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

  await invalidateOnboardingStatusCache(tenantId);
  return { category, product };
}

export async function completeOnboarding(tenantId: string): Promise<{ onboardingComplete: true }> {
  const tenant = await TenantModel.findByIdAndUpdate(tenantId, { onboardingComplete: true }, { new: true });
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  await invalidateTenantCache(tenantId);
  await invalidateOnboardingStatusCache(tenantId);
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
  await invalidateOnboardingStatusCache(tenantId);
  return { onboardingComplete: false };
}
