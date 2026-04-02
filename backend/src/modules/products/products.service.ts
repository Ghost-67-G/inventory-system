import mongoose from 'mongoose';
import { TenantModel } from '../../models/Tenant';
import { CategoryModel } from '../../models/Category';
import { Product } from '../../models/Product';
import { incrementProductCount } from '../categories/categories.service';
import { ApiError } from '../../utils/ApiError';
import { getCache, setCache, deleteCache } from '../../config/redis';
import { isMeiliHealthy, searchProducts } from '../../utils/meilisearch';
import { enqueueProductUpsert, enqueueProductDelete } from '../../queues/jobs/searchSync.job';
import { validateCustomFields } from './products.schema';
import { createAuditLog, diffObjects, type AuditContext } from '../../utils/audit';

interface ListProductsQuery {
  cursor?: string;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: 'true' | 'false' | 'all';
  lowStock?: 'true';
  sortBy?: 'name' | 'sku' | 'totalStock' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  unit?: string;
}

interface ProductListResult {
  products: unknown[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface BulkUpdateData {
  categoryId?: string | null;
  isActive?: boolean;
  lowStockThreshold?: number;
}

/**
 * List products with cursor-based pagination
 * Handles search via MeiliSearch or MongoDB fallback
 */
export async function listProducts(tenantId: string, query: ListProductsQuery): Promise<ProductListResult> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);

  // Search mode
  if (query.search?.trim()) {
    const searchText = query.search.trim();
    const meiliHealthy = await isMeiliHealthy();

    if (meiliHealthy) {
      const ids = await searchProducts(tenantId, searchText, {
        isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
        categoryId: query.categoryId,
        unit: query.unit
      });

      if (ids.length > 0) {
        // Fetch full products in MeiliSearch order
        const products = await Product.find({ tenantId, _id: { $in: ids } })
          .select(
            'tenantId sku name description categoryId unit costPrice sellingPrice ' +
            'totalStock lowStockThreshold isActive images tags customFields createdAt updatedAt createdBy updatedBy'
          )
          .populate('categoryId', '_id name color')
          .lean();

        // Preserve MeiliSearch order
        const productsMap = new Map(products.map((p: unknown) => {
          const product = p as { _id: { toString(): string } };
          return [product._id.toString(), p];
        }));
        const orderedProducts = ids
          .map((id) => productsMap.get(id))
          .filter((p) => p !== undefined)
          .slice(0, limit);

        return { products: orderedProducts, nextCursor: null, hasMore: false };
      }
    }

    // MongoDB fallback search (used when Meili is down or has no indexed hits)
    const baseFilter: Record<string, unknown> = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
    };

    if (query.isActive === 'true') {
      baseFilter.isActive = true;
    } else if (query.isActive === 'false') {
      baseFilter.isActive = false;
    }

    if (query.categoryId) {
      baseFilter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
    }

    if (query.unit) {
      baseFilter.unit = query.unit;
    }

    if (query.lowStock === 'true') {
      baseFilter.$expr = { $lte: ['$totalStock', '$lowStockThreshold'] };
    }

    let products: unknown[] = [];

    try {
      products = await Product.find({
        ...baseFilter,
        $text: { $search: searchText }
      })
        .select(
          'tenantId sku name description categoryId unit costPrice sellingPrice ' +
          'totalStock lowStockThreshold isActive images tags customFields createdAt updatedAt createdBy updatedBy'
        )
        .populate('categoryId', '_id name color')
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .limit(limit + 1)
        .lean();
    } catch {
      // Fallback for environments where Mongo text index has not been created.
      const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      products = await Product.find({
        ...baseFilter,
        $or: [{ name: regex }, { sku: regex }, { description: regex }, { tags: regex }]
      })
        .select(
          'tenantId sku name description categoryId unit costPrice sellingPrice ' +
          'totalStock lowStockThreshold isActive images tags customFields createdAt updatedAt createdBy updatedBy'
        )
        .populate('categoryId', '_id name color')
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .lean();
    }

    const hasMore = products.length > limit;
    if (hasMore) products.pop();

    return { products, nextCursor: null, hasMore };
  }

  // Browse mode with cursor pagination
  const filter: Record<string, unknown> = { tenantId: new mongoose.Types.ObjectId(tenantId) };

  // isActive filter
  if (query.isActive === 'true') {
    filter.isActive = true;
  } else if (query.isActive === 'false') {
    filter.isActive = false;
  }

  // Category filter
  if (query.categoryId) {
    filter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
  }

  // Unit filter
  if (query.unit) {
    filter.unit = query.unit;
  }

  // Low stock filter
  if (query.lowStock === 'true') {
    filter.$expr = { $lte: ['$totalStock', '$lowStockThreshold'] };
  }

  // Cursor filter (only for createdAt sort)
  if (query.cursor && query.sortBy === 'createdAt') {
    const decodedCursor = Buffer.from(query.cursor, 'base64').toString('utf8');
    const cursorObjectId = new mongoose.Types.ObjectId(decodedCursor);
    if (query.sortOrder === 'desc') {
      filter._id = { $lt: cursorObjectId };
    } else {
      filter._id = { $gt: cursorObjectId };
    }
  }

  // Build sort
  const sortDirection: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> =
    query.sortBy === 'name'
      ? { name: sortDirection }
      : query.sortBy === 'sku'
        ? { sku: sortDirection }
        : query.sortBy === 'totalStock'
          ? { totalStock: sortDirection }
          : { createdAt: sortDirection };

  const products = await Product.find(filter)
    .select(
      'tenantId sku name description categoryId unit costPrice sellingPrice ' +
      'totalStock lowStockThreshold isActive images tags customFields createdAt updatedAt createdBy updatedBy'
    )
    .populate('categoryId', '_id name color')
    .sort(sort)
    .limit(limit + 1)
    .lean();

  const hasMore = products.length > limit;
  if (hasMore) products.pop();

  let nextCursor: string | null = null;
  if (hasMore && products.length > 0) {
    const lastDoc = products[products.length - 1] as { _id: { toString(): string } };
    nextCursor = Buffer.from(lastDoc._id.toString()).toString('base64');
  }

  return { products, nextCursor, hasMore };
}

/**
 * Get a single product by ID
 */
export async function getProduct(tenantId: string, productId: string): Promise<unknown> {
  const product = await Product.findOne({
    _id: new mongoose.Types.ObjectId(productId),
    tenantId: new mongoose.Types.ObjectId(tenantId)
  })
    .select(
      'tenantId sku name description categoryId unit costPrice sellingPrice ' +
      'totalStock lowStockThreshold isActive images tags customFields createdAt updatedAt createdBy updatedBy'
    )
    .populate('categoryId', '_id name color')
    .lean();

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  return product;
}

/**
 * Create a new product
 */
export async function createProduct(
  tenantId: string,
  userId: string,
  data: Record<string, unknown>,
  auditCtx: AuditContext
): Promise<unknown> {
  const tenantObjId = new mongoose.Types.ObjectId(tenantId);
  const userObjId = new mongoose.Types.ObjectId(userId);

  // SKU uniqueness within tenant (case-insensitive)
  const sku = (data.sku as string).trim().toUpperCase();
  const existingSku = await Product.findOne({
    tenantId: tenantObjId,
    sku: { $regex: `^${sku}$`, $options: 'i' }
  });

  if (existingSku) {
    throw new ApiError(409, `SKU '${sku}' is already in use`);
  }

  // Verify category if provided
  let categoryId = null;
  if (data.categoryId) {
    categoryId = new mongoose.Types.ObjectId(data.categoryId as string);
    const category = await CategoryModel.findOne({
      _id: categoryId,
      tenantId: tenantObjId
    });
    if (!category) {
      throw new ApiError(400, 'Invalid category');
    }
  }

  // Fetch tenant for custom field validation and default low stock threshold
  const tenant = await TenantModel.findById(tenantObjId)
    .select('customFields settings.lowStockThreshold')
    .lean();

  if (!tenant) {
    throw new ApiError(400, 'Tenant not found');
  }

  // Validate custom fields
  if (tenant && 'customFields' in tenant && Array.isArray(tenant.customFields) && tenant.customFields.length > 0 && data.customFields) {
    const customFieldError = validateCustomFields(
      data.customFields as Record<string, unknown>,
      tenant.customFields as unknown as Array<{ name: string; type: string; required: boolean }>
    );
    if (customFieldError) {
      throw new ApiError(422, customFieldError);
    }
  }

  const defaultLowStockThreshold = (
    tenant && typeof tenant === 'object' && 'settings' in tenant && 
    typeof (tenant as Record<string, unknown>).settings === 'object' &&
    (tenant as Record<string, unknown>).settings !== null &&
    'lowStockThreshold' in ((tenant as Record<string, unknown>).settings as object)
      ? ((tenant as Record<string, unknown>).settings as Record<string, unknown>).lowStockThreshold
      : 0
  ) as number;

  const product = await Product.create({
    tenantId: tenantObjId,
    sku: sku,
    name: (data.name as string).trim(),
    description: (data.description as string)?.trim() ?? '',
    categoryId: categoryId,
    unit: (data.unit as string).trim(),
    costPrice: Number(data.costPrice ?? 0),
    sellingPrice: Number(data.sellingPrice ?? 0),
    lowStockThreshold: Number(data.lowStockThreshold ?? defaultLowStockThreshold ?? 0),
    isActive: true,
    images: (data.images as string[]) ?? [],
    tags: ((data.tags as string[]) ?? []).map((t) => t.toLowerCase().trim()),
    customFields: new Map(Object.entries((data.customFields as Record<string, unknown>) ?? {})),
    totalStock: 0,
    createdBy: userObjId,
    updatedBy: userObjId
  });

  // Increment category product count
  if (categoryId) {
    await incrementProductCount(tenantId, categoryId.toString(), 1);
  }

  // Enqueue MeiliSearch sync (fire and forget)
  enqueueProductUpsert(product._id.toString(), tenantId).catch(() => {});

  // Invalidate count cache
  await deleteCache(`products:count:${tenantId}:*`);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'product.created',
    entityType: 'product',
    entityId: product._id.toString(),
    entityName: `${product.name} (${product.sku})`,
    changes: [],
    metadata: {
      categoryId: product.categoryId,
      unit: product.unit
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return product.toObject();
}

/**
 * Update a product
 */
export async function updateProduct(
  tenantId: string,
  userId: string,
  productId: string,
  data: Record<string, unknown>,
  auditCtx: AuditContext
): Promise<unknown> {
  const tenantObjId = new mongoose.Types.ObjectId(tenantId);
  const userObjId = new mongoose.Types.ObjectId(userId);
  const productObjId = new mongoose.Types.ObjectId(productId);

  const product = await Product.findOne({
    _id: productObjId,
    tenantId: tenantObjId
  });

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const beforeProduct = product.toObject() as Record<string, unknown>;

  // SKU uniqueness check if provided and different
  if (data.sku && (data.sku as string).trim().toUpperCase() !== product.sku) {
    const sku = (data.sku as string).trim().toUpperCase();
    const conflict = await Product.findOne({
      tenantId: tenantObjId,
      _id: { $ne: productObjId },
      sku: { $regex: `^${sku}$`, $options: 'i' }
    });
    if (conflict) {
      throw new ApiError(409, `SKU '${sku}' is already in use`);
    }
  }

  // Handle category change
  if (data.categoryId !== undefined) {
    const newCategoryId = data.categoryId ? new mongoose.Types.ObjectId(data.categoryId as string) : null;
    const oldCategoryId = product.categoryId;

    if (oldCategoryId && (!newCategoryId || oldCategoryId.toString() !== newCategoryId.toString())) {
      await incrementProductCount(tenantId, oldCategoryId.toString(), -1);
    }

    if (newCategoryId && (!oldCategoryId || oldCategoryId.toString() !== newCategoryId.toString())) {
      const category = await CategoryModel.findOne({
        _id: newCategoryId,
        tenantId: tenantObjId
      });
      if (!category) {
        throw new ApiError(400, 'Invalid category');
      }
      await incrementProductCount(tenantId, newCategoryId.toString(), 1);
    }

    product.categoryId = newCategoryId as mongoose.Types.ObjectId | null;
  }

  // Validate custom fields if provided
  if (data.customFields) {
    const tenant = await TenantModel.findById(tenantObjId)
      .select('customFields')
      .lean();

    if (tenant && typeof tenant === 'object' && 'customFields' in tenant && Array.isArray((tenant as Record<string, unknown>).customFields) && ((tenant as Record<string, unknown>).customFields as unknown[]).length > 0) {
      const customFieldError = validateCustomFields(
        data.customFields as Record<string, unknown>,
        (tenant as Record<string, unknown>).customFields as Array<{ name: string; type: string; required: boolean }>
      );
      if (customFieldError) {
        throw new ApiError(422, customFieldError);
      }
    }

    product.customFields = new Map(Object.entries(data.customFields as Record<string, unknown>));
  }

  // Update fields
  if (data.sku) product.sku = (data.sku as string).trim().toUpperCase();
  if (data.name) product.name = (data.name as string).trim();
  if (data.description !== undefined) product.description = (data.description as string)?.trim() ?? '';
  if (data.unit) product.unit = (data.unit as string).trim();
  if (data.costPrice !== undefined) product.costPrice = Number(data.costPrice);
  if (data.sellingPrice !== undefined) product.sellingPrice = Number(data.sellingPrice);
  if (data.lowStockThreshold !== undefined) product.lowStockThreshold = Number(data.lowStockThreshold);
  if (data.isActive !== undefined) product.isActive = Boolean(data.isActive);
  if (data.images !== undefined) product.images = (data.images as string[]) ?? [];
  if (data.tags !== undefined) {
    product.tags = ((data.tags as string[]) ?? []).map((t) => t.toLowerCase().trim());
  }

  product.updatedBy = userObjId;
  await product.save();

  // Enqueue MeiliSearch sync (fire and forget)
  enqueueProductUpsert(product._id.toString(), tenantId).catch(() => {});

  // Invalidate count cache
  await deleteCache(`products:count:${tenantId}:*`);

  const afterProduct = product.toObject() as Record<string, unknown>;
  const changes = diffObjects(beforeProduct, afterProduct);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'product.updated',
    entityType: 'product',
    entityId: product._id.toString(),
    entityName: `${product.name} (${product.sku})`,
    changes,
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return product.toObject();
}

/**
 * Delete a product
 */
export async function deleteProduct(
  tenantId: string,
  userId: string,
  productId: string,
  auditCtx: AuditContext
): Promise<void> {
  const tenantObjId = new mongoose.Types.ObjectId(tenantId);
  const productObjId = new mongoose.Types.ObjectId(productId);

  const product = await Product.findOne({
    _id: productObjId,
    tenantId: tenantObjId
  });

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  // Cannot delete if stock > 0
  if (product.totalStock > 0) {
    throw new ApiError(
      400,
      `Cannot delete this product — it has ${product.totalStock} units in stock. ` +
        'Adjust stock to zero or deactivate the product instead.'
    );
  }

  // Decrement category product count
  if (product.categoryId) {
    await incrementProductCount(tenantId, product.categoryId.toString(), -1);
  }

  await Product.deleteOne({ _id: productObjId });

  // Enqueue MeiliSearch delete (fire and forget)
  enqueueProductDelete(productId).catch(() => {});

  // Invalidate count cache
  await deleteCache(`products:count:${tenantId}:*`);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'product.deleted',
    entityType: 'product',
    entityId: productObjId.toString(),
    entityName: `${product.name} (${product.sku})`,
    changes: [],
    metadata: {
      sku: product.sku,
      totalStock: product.totalStock
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});
}

/**
 * Bulk update products
 */
export async function bulkUpdate(
  tenantId: string,
  userId: string,
  productIds: string[],
  updates: BulkUpdateData,
  auditCtx: AuditContext
): Promise<{ updated: number }> {
  const tenantObjId = new mongoose.Types.ObjectId(tenantId);
  const userObjId = new mongoose.Types.ObjectId(userId);

  // Verify all products belong to tenant
  const count = await Product.countDocuments({
    tenantId: tenantObjId,
    _id: { $in: productIds.map((id) => new mongoose.Types.ObjectId(id)) }
  });

  if (count !== productIds.length) {
    throw new ApiError(400, 'One or more products not found');
  }

  // Verify category if updating
  if (updates.categoryId !== undefined && updates.categoryId !== null) {
    const category = await CategoryModel.findOne({
      _id: new mongoose.Types.ObjectId(updates.categoryId),
      tenantId: tenantObjId
    });
    if (!category) {
      throw new ApiError(400, 'Invalid category');
    }
  }

  // Build update object
  const $set: Record<string, unknown> = {
    updatedBy: userObjId,
    updatedAt: new Date()
  };

  if (updates.categoryId !== undefined) $set.categoryId = updates.categoryId ? new mongoose.Types.ObjectId(updates.categoryId) : null;
  if (updates.isActive !== undefined) $set.isActive = updates.isActive;
  if (updates.lowStockThreshold !== undefined) $set.lowStockThreshold = updates.lowStockThreshold;

  await Product.updateMany(
    {
      tenantId: tenantObjId,
      _id: { $in: productIds.map((id) => new mongoose.Types.ObjectId(id)) }
    },
    { $set }
  );

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'product.updated',
    entityType: 'product',
    entityName: `${productIds.length} products (bulk update)`,
    changes: Object.entries(updates)
      .filter(([, value]) => value !== undefined)
      .map(([field, newValue]) => ({ field, oldValue: null, newValue })),
    metadata: {
      bulk: true,
      productIds,
      updatedCount: productIds.length
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  // Enqueue MeiliSearch sync for each product (fire and forget)
  Promise.allSettled(
    productIds.map((id) => enqueueProductUpsert(id, tenantId))
  ).catch(() => {});

  // Invalidate count cache
  await deleteCache(`products:count:${tenantId}:*`);

  return { updated: productIds.length };
}

/**
 * Get product count with caching
 */
export async function getProductCount(
  tenantId: string,
  filters?: Record<string, unknown>
): Promise<{ count: number }> {
  const filterHash = filters ? JSON.stringify(filters) : 'all';
  const cacheKey = `products:count:${tenantId}:${filterHash}`;

  const cached = await getCache<number>(cacheKey);
  if (cached !== null) {
    return { count: cached };
  }

  const filter: Record<string, unknown> = { tenantId: new mongoose.Types.ObjectId(tenantId) };

  if (filters?.isActive === 'true') filter.isActive = true;
  else if (filters?.isActive === 'false') filter.isActive = false;

  if (filters?.categoryId) filter.categoryId = new mongoose.Types.ObjectId(filters.categoryId as string);
  if (filters?.unit) filter.unit = filters.unit;
  if (filters?.lowStock === 'true') {
    filter.$expr = { $lte: ['$totalStock', '$lowStockThreshold'] };
  }

  const count = await Product.countDocuments(filter);

  await setCache(cacheKey, count, 60);

  return { count };
}
