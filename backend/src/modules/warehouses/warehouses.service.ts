import { WarehouseModel, type IWarehouse } from '../../models/Warehouse';
import { WarehouseStockModel, type IWarehouseStock } from '../../models/WarehouseStock';
import { Product } from '../../models/Product';
import { ApiError } from '../../utils/ApiError';
import { redis } from '../../config/redis';
import { deleteCache, getCache, setCache } from '../../config/redis';
import mongoose from 'mongoose';
import { createAuditLog, diffObjects, type AuditContext } from '../../utils/audit';

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

// ─── Types ────────────────────────────────────────────────────────────────

interface ListWarehousesQuery {
  isActive?: 'true' | 'false';
  search?: string;
}

interface CreateWarehouseDto {
  name: string;
  code?: string;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  isDefault?: boolean;
}

interface UpdateWarehouseDto extends Partial<CreateWarehouseDto> {
  isActive?: boolean;
}

interface WarehouseStockQuery {
  search?: string;
  lowStock?: 'true' | 'false';
  cursor?: string;
  limit?: number;
}

interface WarehouseWithSummary extends Omit<IWarehouse, 'toJSON'> {
  stockSummary: {
    totalProducts: number;
    totalUnits: number;
  };
}

type WarehouseStockSummary = {
  totalProducts: number;
  totalUnits: number;
};

interface StockItem {
  product: {
    _id: string;
    name: string;
    sku: string;
    unit: string;
    lowStockThreshold: number;
    categoryId: string | null;
  };
  quantity: number;
  reservedQuantity: number;
}

interface StockResponse {
  stock: StockItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface WarehouseSummary {
  total: number;
  active: number;
  totalProducts: number;
  totalUnits: number;
}

// ─── Cache Helpers ────────────────────────────────────────────────────────

export async function invalidateWarehouseCache(tenantId: string): Promise<void> {
  const listPattern = `warehouses:list:${tenantId}:*`;
  const listKeys = await redis.keys(listPattern);
  if (listKeys.length > 0) {
    await redis.del(...listKeys);
  }
  await deleteCache(`warehouses:summary:${tenantId}`);
}

function getListCacheKey(tenantId: string, query: ListWarehousesQuery): string {
  const isActive = query.isActive ?? 'true';
  const search = (query.search ?? '').trim().toLowerCase();
  return `warehouses:list:${tenantId}:active=${isActive}:search=${encodeURIComponent(search)}`;
}

// ─── Stock Summary Fetching ────────────────────────────────────────────────

async function getStockSummariesForWarehouses(
  tenantId: string,
  warehouseIds: mongoose.Types.ObjectId[]
): Promise<Record<string, WarehouseStockSummary>> {
  const result = await WarehouseStockModel.aggregate([
    {
      $match: {
        tenantId: toObjectId(tenantId),
        warehouseId: { $in: warehouseIds },
        quantity: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: '$warehouseId',
        totalProducts: { $sum: 1 },
        totalUnits: { $sum: '$quantity' }
      }
    }
  ]);

  const summaryMap: Record<string, WarehouseStockSummary> = {};
  for (const doc of result) {
    summaryMap[doc._id.toString()] = {
      totalProducts: doc.totalProducts || 0,
      totalUnits: doc.totalUnits || 0
    };
  }
  return summaryMap;
}

async function getStockSummary(
  tenantId: string,
  warehouseId: mongoose.Types.ObjectId
): Promise<{ totalProducts: number; totalUnits: number }> {
  const result = await WarehouseStockModel.aggregate([
    {
      $match: {
        tenantId: toObjectId(tenantId),
        warehouseId,
        quantity: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalUnits: { $sum: '$quantity' }
      }
    }
  ]);

  if (result.length === 0) {
    return { totalProducts: 0, totalUnits: 0 };
  }
  return result[0];
}

// ─── List Warehouses ──────────────────────────────────────────────────────

export async function listWarehouses(
  tenantId: string,
  query: ListWarehousesQuery
): Promise<WarehouseWithSummary[]> {
  const cacheKey = getListCacheKey(tenantId, query);
  const cached = await getCache<WarehouseWithSummary[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const showActive = query.isActive !== 'false';
  const filter: Record<string, unknown> = { tenantId, isActive: showActive };

  if (query.search) {
    const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { code: { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  const warehouses = await WarehouseModel.find(filter)
    .sort({ isDefault: -1, name: 1 })
    .lean();

  // Fetch stock summaries for all warehouses in one aggregate
  const warehouseIds = warehouses.map((w) => w._id);
  const stockSummaries = await getStockSummariesForWarehouses(tenantId, warehouseIds);

  const result = warehouses.map((warehouse) => ({
    ...warehouse,
    stockSummary: stockSummaries[warehouse._id.toString()] || { totalProducts: 0, totalUnits: 0 }
  }));

  await setCache(cacheKey, result, 120);
  return result as unknown as WarehouseWithSummary[];
}

// ─── Get Warehouse ────────────────────────────────────────────────────────

export async function getWarehouse(
  tenantId: string,
  warehouseId: string
): Promise<WarehouseWithSummary> {
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, tenantId }).lean();
  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found');
  }

  const stockSummary = await getStockSummary(tenantId, warehouse._id);

  return {
    ...warehouse,
    stockSummary
  } as unknown as WarehouseWithSummary;
}

// ─── Create Warehouse ─────────────────────────────────────────────────────

export async function createWarehouse(
  tenantId: string,
  userId: string,
  data: CreateWarehouseDto,
  auditCtx: AuditContext
): Promise<IWarehouse> {
  // Auto-generate code if not provided
  let code = data.code;
  if (!code) {
    const count = await WarehouseModel.countDocuments({ tenantId });
    code = 'WH-' + String(count + 1).padStart(3, '0');
  }

  // Ensure code is uppercase for comparison
  const codeUppercase = code.toUpperCase();

  // Check code uniqueness within tenant
  const existing = await WarehouseModel.findOne({
    tenantId,
    code: codeUppercase
  });
  if (existing) {
    throw new ApiError(409, `Warehouse code '${codeUppercase}' is already in use`);
  }

  // Determine if this should be the default
  const existingCount = await WarehouseModel.countDocuments({ tenantId });
  const shouldBeDefault = data.isDefault === true || existingCount === 0;

  // If this should be default, unset default on all others
  if (shouldBeDefault) {
    await WarehouseModel.updateMany({ tenantId }, { $set: { isDefault: false } });
  }

  // Create warehouse
  const warehouse = await WarehouseModel.create({
    tenantId,
    name: data.name,
    code: codeUppercase,
    description: data.description || '',
    address: data.address || {},
    isDefault: shouldBeDefault,
    createdBy: userId
  });

  // Invalidate cache
  await invalidateWarehouseCache(tenantId);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'warehouse.created',
    entityType: 'warehouse',
    entityId: warehouse._id.toString(),
    entityName: `${warehouse.name} (${warehouse.code})`,
    changes: [],
    metadata: {
      code: warehouse.code,
      isDefault: warehouse.isDefault,
      isActive: warehouse.isActive
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return warehouse;
}

// ─── Update Warehouse ─────────────────────────────────────────────────────

export async function updateWarehouse(
  tenantId: string,
  warehouseId: string,
  userId: string,
  data: UpdateWarehouseDto,
  auditCtx: AuditContext
): Promise<IWarehouse> {
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, tenantId });
  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found');
  }

  const beforeWarehouse = warehouse.toObject() as unknown as Record<string, unknown>;

  // Check code uniqueness if code is provided and different
  if (data.code && data.code.toUpperCase() !== warehouse.code) {
    const codeUppercase = data.code.toUpperCase();
    const existing = await WarehouseModel.findOne({
      tenantId,
      code: codeUppercase,
      _id: { $ne: warehouseId }
    });
    if (existing) {
      throw new ApiError(409, `Warehouse code '${codeUppercase}' is already in use`);
    }
  }

  // Handle isDefault
  if (data.isDefault === true) {
    await WarehouseModel.updateMany({ tenantId, _id: { $ne: warehouseId } }, { $set: { isDefault: false } });
  }

  if (data.isDefault === false) {
    // Check if this is currently the only default
    const otherDefaults = await WarehouseModel.countDocuments({
      tenantId,
      isDefault: true,
      _id: { $ne: warehouseId }
    });
    if (otherDefaults === 0 && warehouse.isDefault) {
      throw new ApiError(
        400,
        'At least one warehouse must be the default. Set another warehouse as default first.'
      );
    }
  }

  // Apply updates
  if (data.name) warehouse.name = data.name;
  if (data.code) warehouse.code = data.code.toUpperCase();
  if (data.description !== undefined) warehouse.description = data.description;
  if (data.address) warehouse.address = { ...warehouse.address, ...data.address };
  if (data.isDefault !== undefined) warehouse.isDefault = data.isDefault;
  if (data.isActive !== undefined) warehouse.isActive = data.isActive;

  await warehouse.save();

  // Invalidate cache
  await invalidateWarehouseCache(tenantId);

  const afterWarehouse = warehouse.toObject() as unknown as Record<string, unknown>;
  const changes = diffObjects(beforeWarehouse, afterWarehouse);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'warehouse.updated',
    entityType: 'warehouse',
    entityId: warehouse._id.toString(),
    entityName: `${warehouse.name} (${warehouse.code})`,
    changes,
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return warehouse;
}

// ─── Deactivate Warehouse ─────────────────────────────────────────────────

export async function deactivateWarehouse(
  tenantId: string,
  warehouseId: string,
  requesterId: string,
  auditCtx: AuditContext
): Promise<IWarehouse> {
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, tenantId });
  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found');
  }

  if (!warehouse.isActive) {
    throw new ApiError(400, 'Warehouse is already inactive');
  }

  // Check if this is the last active warehouse
  const activeCount = await WarehouseModel.countDocuments({ tenantId, isActive: true });
  if (activeCount <= 1) {
    throw new ApiError(400, 'Cannot deactivate the only active warehouse');
  }

  // Check stock
  const totalStock = await WarehouseStockModel.aggregate([
    { $match: { tenantId: toObjectId(tenantId), warehouseId: warehouse._id } },
    { $group: { _id: null, total: { $sum: '$quantity' } } }
  ]);

  const stock = totalStock.length > 0 ? totalStock[0].total : 0;
  if (stock > 0) {
    throw new ApiError(400, `This warehouse contains ${stock} units of stock. Transfer all stock to another warehouse before deactivating.`);
  }

  // If this is the default warehouse, assign default to another active warehouse
  if (warehouse.isDefault) {
    const nextDefault = await WarehouseModel.findOne({
      tenantId,
      isActive: true,
      _id: { $ne: warehouseId }
    });
    if (nextDefault) {
      nextDefault.isDefault = true;
      await nextDefault.save();
    }
  }

  // Deactivate
  warehouse.isActive = false;
  warehouse.isDefault = false;
  await warehouse.save();

  // Invalidate cache
  await invalidateWarehouseCache(tenantId);

  createAuditLog({
    tenantId,
    performedBy: requesterId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'warehouse.deactivated',
    entityType: 'warehouse',
    entityId: warehouse._id.toString(),
    entityName: `${warehouse.name} (${warehouse.code})`,
    changes: [{ field: 'isActive', oldValue: true, newValue: false }],
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return warehouse;
}

// ─── Reactivate Warehouse ─────────────────────────────────────────────────

export async function reactivateWarehouse(
  tenantId: string,
  warehouseId: string,
  requesterId: string,
  auditCtx: AuditContext
): Promise<IWarehouse> {
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, tenantId });
  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found');
  }

  if (warehouse.isActive) {
    throw new ApiError(400, 'Warehouse is already active');
  }

  warehouse.isActive = true;
  await warehouse.save();

  // Invalidate cache
  await invalidateWarehouseCache(tenantId);

  createAuditLog({
    tenantId,
    performedBy: requesterId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'warehouse.reactivated',
    entityType: 'warehouse',
    entityId: warehouse._id.toString(),
    entityName: `${warehouse.name} (${warehouse.code})`,
    changes: [{ field: 'isActive', oldValue: false, newValue: true }],
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return warehouse;
}

// ─── Set Default Warehouse ────────────────────────────────────────────────

export async function setDefaultWarehouse(
  tenantId: string,
  warehouseId: string
): Promise<IWarehouse> {
  const warehouse = await WarehouseModel.findOne({
    _id: warehouseId,
    tenantId,
    isActive: true
  });
  if (!warehouse) {
    throw new ApiError(404, 'Active warehouse not found');
  }

  if (warehouse.isDefault) {
    throw new ApiError(400, 'This warehouse is already the default');
  }

  // Unset all defaults
  await WarehouseModel.updateMany({ tenantId }, { $set: { isDefault: false } });

  // Set this one
  warehouse.isDefault = true;
  await warehouse.save();

  // Invalidate cache
  await invalidateWarehouseCache(tenantId);

  return warehouse;
}

// ─── Get Warehouse Stock ──────────────────────────────────────────────────

export async function getWarehouseStock(
  tenantId: string,
  warehouseId: string,
  query: WarehouseStockQuery
): Promise<StockResponse> {
  // Verify warehouse exists
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, tenantId });
  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found');
  }

  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const showLowStock = query.lowStock === 'true';

  // Build aggregation pipeline
  const pipeline: mongoose.PipelineStage[] = [
    {
      $match: {
        tenantId: toObjectId(tenantId),
        warehouseId: warehouse._id,
        quantity: { $gt: 0 }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $unwind: '$product'
    },
    {
      $match: {
        'product.isActive': true
      }
    }
  ];

  // Add low stock filter if requested
  if (showLowStock) {
    pipeline.push({
      $match: {
        $expr: {
          $lte: ['$quantity', '$product.lowStockThreshold']
        }
      }
    });
  }

  // Add search filter
  if (query.search) {
    const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pipeline.push({
      $match: {
        $or: [
          { 'product.name': { $regex: escapedSearch, $options: 'i' } },
          { 'product.sku': { $regex: escapedSearch, $options: 'i' } }
        ]
      }
    });
  }

  // Add sorting
  pipeline.push({
    $sort: { 'product.name': 1 }
  });

  // Apply cursor-based pagination
  if (query.cursor) {
    try {
      const decodedCursor = Buffer.from(query.cursor, 'base64').toString('utf-8');
      pipeline.push({
        $match: {
          'product.name': { $gt: decodedCursor }
        }
      });
    } catch {
      // Invalid cursor, skip
    }
  }

  // Fetch one extra to check if there are more
  pipeline.push({ $limit: limit + 1 });

  // Project only needed fields
  pipeline.push({
    $project: {
      quantity: 1,
      reservedQuantity: 1,
      product: {
        _id: 1,
        name: 1,
        sku: 1,
        unit: 1,
        lowStockThreshold: 1,
        categoryId: 1
      }
    }
  });

  const results = await WarehouseStockModel.aggregate<StockItem>(pipeline);

  let hasMore = false;
  let nextCursor: string | null = null;

  if (results.length > limit) {
    hasMore = true;
    results.pop();
    const lastItem = results[results.length - 1];
    if (lastItem) {
      nextCursor = Buffer.from(lastItem.product.name).toString('base64');
    }
  }

  return {
    stock: results,
    nextCursor,
    hasMore
  };
}

// ─── Get Warehouse Summary ────────────────────────────────────────────────

export async function getWarehouseSummary(tenantId: string): Promise<WarehouseSummary> {
  const cacheKey = `warehouses:summary:${tenantId}`;
  const cached = await getCache<WarehouseSummary>(cacheKey);
  if (cached) {
    return cached;
  }

  const [total, active] = await Promise.all([
    WarehouseModel.countDocuments({ tenantId }),
    WarehouseModel.countDocuments({ tenantId, isActive: true })
  ]);

  const stockResult = await WarehouseStockModel.aggregate([
    {
      $match: {
        tenantId: toObjectId(tenantId),
        quantity: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalUnits: { $sum: '$quantity' }
      }
    }
  ]);

  const stock = stockResult.length > 0 ? stockResult[0] : { totalProducts: 0, totalUnits: 0 };

  const result: WarehouseSummary = {
    total,
    active,
    totalProducts: stock.totalProducts || 0,
    totalUnits: stock.totalUnits || 0
  };

  await setCache(cacheKey, result, 300);
  return result;
}

