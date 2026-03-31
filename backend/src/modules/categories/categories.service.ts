import { getCache, setCache, deleteCache } from '../../config/redis';
import { CategoryModel } from '../../models/Category';
import { Product } from '../../models/Product';
import { ApiError } from '../../utils/ApiError';
import { createAuditLog, diffObjects, type AuditContext } from '../../utils/audit';

interface ListCategoriesQuery {
  search?: string;
  isActive?: 'true' | 'false';
  page?: number;
  limit?: number;
}

interface CategoryListResult {
  categories: unknown[];
  total: number;
  page: number;
  totalPages: number;
}

interface CreateCategoryDto {
  name: string;
  description?: string;
  color?: string;
}

interface UpdateCategoryDto {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function invalidateDropdownCache(tenantId: string): Promise<void> {
  await deleteCache(`categories:dropdown:${tenantId}`);
}

export async function listCategories(
  tenantId: string,
  query: ListCategoriesQuery
): Promise<CategoryListResult> {
  const page = Math.max(query.page ?? 1, 1);
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const skip = (page - 1) * limit;

  const showActive = query.isActive !== 'false';
  const filter: Record<string, unknown> = { tenantId, isActive: showActive };

  if (query.search) {
    filter['name'] = { $regex: escapeRegex(query.search), $options: 'i' };
  }

  const [categories, total] = await Promise.all([
    CategoryModel.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    CategoryModel.countDocuments(filter)
  ]);

  return { categories, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getCategory(tenantId: string, categoryId: string): Promise<unknown> {
  const category = await CategoryModel.findOne({ _id: categoryId, tenantId }).lean();
  if (!category) throw new ApiError(404, 'Category not found');
  return category;
}

export async function createCategory(
  tenantId: string,
  userId: string,
  data: CreateCategoryDto,
  auditCtx: AuditContext
): Promise<unknown> {
  const escapedName = escapeRegex(data.name.trim());
  const existing = await CategoryModel.findOne({
    tenantId,
    name: { $regex: `^${escapedName}$`, $options: 'i' }
  });
  if (existing) throw new ApiError(409, 'A category with this name already exists');

  const category = await CategoryModel.create({
    tenantId,
    name: data.name.trim(),
    description: data.description ?? '',
    color: data.color ?? '#6366f1',
    createdBy: userId
  });

  await invalidateDropdownCache(tenantId);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'category.created',
    entityType: 'category',
    entityId: category._id.toString(),
    entityName: category.name,
    metadata: {
      description: category.description,
      color: category.color
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return category;
}

export async function updateCategory(
  tenantId: string,
  categoryId: string,
  data: UpdateCategoryDto,
  userId: string,
  auditCtx: AuditContext
): Promise<unknown> {
  const category = await CategoryModel.findOne({ _id: categoryId, tenantId });
  if (!category) throw new ApiError(404, 'Category not found');

  const before = category.toObject();

  if (data.name !== undefined) {
    const escapedName = escapeRegex(data.name.trim());
    const conflict = await CategoryModel.findOne({
      tenantId,
      _id: { $ne: categoryId },
      name: { $regex: `^${escapedName}$`, $options: 'i' }
    });
    if (conflict) throw new ApiError(409, 'A category with this name already exists');
    category.name = data.name.trim();
  }

  if (data.description !== undefined) category.description = data.description;
  if (data.color !== undefined) category.color = data.color;
  if (data.isActive !== undefined) category.isActive = data.isActive;

  await category.save();
  await invalidateDropdownCache(tenantId);

  const changes = diffObjects(before as Record<string, unknown>, category.toObject() as Record<string, unknown>);
  if (changes.length > 0) {
    createAuditLog({
      tenantId,
      performedBy: userId,
      performedByName: auditCtx.performedByName,
      performedByEmail: auditCtx.performedByEmail,
      action: 'category.updated',
      entityType: 'category',
      entityId: category._id.toString(),
      entityName: category.name,
      changes,
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent
    }).catch(() => {});
  }

  return category;
}

export async function deleteCategory(
  tenantId: string,
  categoryId: string,
  userId: string,
  auditCtx: AuditContext
): Promise<void> {
  const category = await CategoryModel.findOne({ _id: categoryId, tenantId });
  if (!category) throw new ApiError(404, 'Category not found');

  const count = await Product.countDocuments({ tenantId, categoryId, isActive: true });
  if (count > 0) {
    throw new ApiError(
      400,
      `Cannot delete this category — ${count} product${count > 1 ? 's are' : ' is'} assigned to it. Reassign or deactivate those products first.`
    );
  }

  await CategoryModel.deleteOne({ _id: categoryId });
  await invalidateDropdownCache(tenantId);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'category.deleted',
    entityType: 'category',
    entityId: category._id.toString(),
    entityName: category.name,
    metadata: {
      description: category.description,
      color: category.color,
      productCount: category.productCount
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});
}

export async function getCategoriesForDropdown(tenantId: string): Promise<unknown[]> {
  const cacheKey = `categories:dropdown:${tenantId}`;

  const cached = await getCache<unknown[]>(cacheKey);
  if (cached !== null) return cached;

  const categories = await CategoryModel.find({ tenantId, isActive: true })
    .select('_id name color')
    .sort({ name: 1 })
    .lean();

  await setCache(cacheKey, categories, 300);
  return categories;
}

export async function incrementProductCount(
  tenantId: string,
  categoryId: string,
  delta: 1 | -1
): Promise<void> {
  await CategoryModel.findOneAndUpdate(
    { _id: categoryId, tenantId },
    [{ $set: { productCount: { $max: [0, { $add: ['$productCount', delta] }] } } }]
  );
}
