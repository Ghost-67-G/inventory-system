import mongoose from 'mongoose';
import { getCache, setCache, deleteCache } from '../../config/redis';
import { Product } from '../../models/Product';
import { PurchaseOrderModel } from '../../models/PurchaseOrder';
import { SupplierModel } from '../../models/Supplier';
import { SupplierProductModel } from '../../models/SupplierProduct';
import { ApiError } from '../../utils/ApiError';
import { createAuditLog, diffObjects, type AuditContext } from '../../utils/audit';
import type {
  CreateSupplierBody,
  LinkSupplierProductBody,
  ListSuppliersQuery,
  UpdateSupplierBody,
  UpdateSupplierProductBody
} from './suppliers.schema';

interface SupplierListResult {
  suppliers: unknown[];
  nextCursor: string | null;
  hasMore: boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildCursor(name: string, id: string): string {
  return Buffer.from(JSON.stringify({ name, id })).toString('base64');
}

function parseCursor(cursor: string): { name: string; id: mongoose.Types.ObjectId } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as { name?: string; id?: string };
    if (!parsed.name || !parsed.id || !mongoose.Types.ObjectId.isValid(parsed.id)) {
      return null;
    }
    return { name: parsed.name, id: new mongoose.Types.ObjectId(parsed.id) };
  } catch {
    return null;
  }
}

async function invalidateSuppliersDropdownCache(tenantId: string): Promise<void> {
  await deleteCache(`suppliers:dropdown:${tenantId}`);
}

export async function listSuppliers(tenantId: string, query: ListSuppliersQuery): Promise<SupplierListResult> {
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
  const filter: Record<string, unknown> = {
    tenantId: new mongoose.Types.ObjectId(tenantId)
  };

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true';
  } else {
    filter.isActive = true;
  }

  if (query.search) {
    const searchRegex = { $regex: escapeRegex(query.search), $options: 'i' };
    filter.$or = [
      { name: searchRegex },
      { code: searchRegex },
      { contactName: searchRegex },
      { email: searchRegex }
    ];
  }

  const parsedCursor = query.cursor ? parseCursor(query.cursor) : null;
  if (query.cursor && !parsedCursor) {
    throw new ApiError(400, 'Invalid cursor');
  }

  if (parsedCursor) {
    filter.$and = [
      {
        $or: [
          { name: { $gt: parsedCursor.name } },
          { name: parsedCursor.name, _id: { $gt: parsedCursor.id } }
        ]
      }
    ];
  }

  const suppliers = await SupplierModel.find(filter)
    .sort({ name: 1, _id: 1 })
    .limit(limit + 1)
    .lean();

  const hasMore = suppliers.length > limit;
  if (hasMore) {
    suppliers.pop();
  }

  const last = suppliers[suppliers.length - 1];
  const nextCursor = hasMore && last ? buildCursor(String(last.name ?? ''), String(last._id)) : null;

  return { suppliers, nextCursor, hasMore };
}

export async function getSupplier(tenantId: string, supplierId: string): Promise<{ supplier: unknown; recentPOs: unknown[] }> {
  const supplier = await SupplierModel.findOne({ _id: supplierId, tenantId }).lean();
  if (!supplier) {
    throw new ApiError(404, 'Supplier not found');
  }

  const recentPOs = await PurchaseOrderModel.find({ tenantId, supplierId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('poNumber status totalAmount currency createdAt expectedDeliveryDate receivedDate')
    .lean();

  return { supplier, recentPOs };
}

export async function createSupplier(
  tenantId: string,
  userId: string,
  data: CreateSupplierBody,
  auditCtx: AuditContext
): Promise<unknown> {
  let code = data.code?.trim().toUpperCase();

  if (!code) {
    const count = await SupplierModel.countDocuments({ tenantId });
    code = `SUP-${String(count + 1).padStart(3, '0')}`;
  }

  const escaped = escapeRegex(code);
  const existing = await SupplierModel.findOne({
    tenantId,
    code: { $regex: `^${escaped}$`, $options: 'i' }
  }).select('_id');

  if (existing) {
    throw new ApiError(409, 'Supplier code already exists');
  }

  const supplier = await SupplierModel.create({
    tenantId,
    name: data.name,
    code,
    contactName: data.contactName ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    website: data.website ?? '',
    address: {
      street: data.address?.street ?? '',
      city: data.address?.city ?? '',
      state: data.address?.state ?? '',
      country: data.address?.country ?? '',
      postalCode: data.address?.postalCode ?? ''
    },
    paymentTerms: data.paymentTerms ?? 'net30',
    paymentTermsDays: data.paymentTerms === 'custom' ? data.paymentTermsDays ?? 30 : 30,
    currency: data.currency ?? 'USD',
    leadTimeDays: data.leadTimeDays ?? 7,
    minimumOrderValue: data.minimumOrderValue ?? 0,
    notes: data.notes ?? '',
    createdBy: userId
  });

  await invalidateSuppliersDropdownCache(tenantId);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'supplier.created',
    entityType: 'supplier',
    entityId: supplier.id,
    entityName: supplier.name,
    metadata: {
      code: supplier.code,
      currency: supplier.currency,
      paymentTerms: supplier.paymentTerms
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return supplier;
}

export async function updateSupplier(
  tenantId: string,
  supplierId: string,
  data: UpdateSupplierBody,
  userId: string,
  auditCtx: AuditContext
): Promise<unknown> {
  const supplier = await SupplierModel.findOne({ _id: supplierId, tenantId });
  if (!supplier) {
    throw new ApiError(404, 'Supplier not found');
  }

  const before = supplier.toObject();

  if (data.code) {
    const code = data.code.trim().toUpperCase();
    const escaped = escapeRegex(code);
    const existing = await SupplierModel.findOne({
      tenantId,
      _id: { $ne: supplierId },
      code: { $regex: `^${escaped}$`, $options: 'i' }
    }).select('_id');

    if (existing) {
      throw new ApiError(409, 'Supplier code already exists');
    }

    supplier.code = code;
  }

  if (data.name !== undefined) supplier.name = data.name;
  if (data.contactName !== undefined) supplier.contactName = data.contactName;
  if (data.email !== undefined) supplier.email = data.email;
  if (data.phone !== undefined) supplier.phone = data.phone;
  if (data.website !== undefined) supplier.website = data.website;
  if (data.paymentTerms !== undefined) supplier.paymentTerms = data.paymentTerms;
  if (data.paymentTermsDays !== undefined) supplier.paymentTermsDays = data.paymentTermsDays;
  if (data.currency !== undefined) supplier.currency = data.currency;
  if (data.leadTimeDays !== undefined) supplier.leadTimeDays = data.leadTimeDays;
  if (data.minimumOrderValue !== undefined) supplier.minimumOrderValue = roundTo2(data.minimumOrderValue);
  if (data.notes !== undefined) supplier.notes = data.notes;

  if (data.address) {
    supplier.address.street = data.address.street ?? supplier.address.street;
    supplier.address.city = data.address.city ?? supplier.address.city;
    supplier.address.state = data.address.state ?? supplier.address.state;
    supplier.address.country = data.address.country ?? supplier.address.country;
    supplier.address.postalCode = data.address.postalCode ?? supplier.address.postalCode;
  }

  await supplier.save();
  await invalidateSuppliersDropdownCache(tenantId);

  const changes = diffObjects(
    before as unknown as Record<string, unknown>,
    supplier.toObject() as unknown as Record<string, unknown>
  );

  if (changes.length > 0) {
    createAuditLog({
      tenantId,
      performedBy: userId,
      performedByName: auditCtx.performedByName,
      performedByEmail: auditCtx.performedByEmail,
      action: 'supplier.updated',
      entityType: 'supplier',
      entityId: supplier.id,
      entityName: supplier.name,
      changes,
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent
    }).catch(() => {});
  }

  return supplier;
}

export async function deactivateSupplier(
  tenantId: string,
  supplierId: string,
  userId: string,
  auditCtx: AuditContext
): Promise<void> {
  const supplier = await SupplierModel.findOne({ _id: supplierId, tenantId });
  if (!supplier) {
    throw new ApiError(404, 'Supplier not found');
  }

  const openOrders = await PurchaseOrderModel.countDocuments({
    tenantId,
    supplierId,
    status: { $in: ['DRAFT', 'SENT', 'PARTIAL'] }
  });

  if (openOrders > 0) {
    throw new ApiError(400, 'Cannot deactivate supplier with open purchase orders');
  }

  supplier.isActive = false;
  await supplier.save();
  await invalidateSuppliersDropdownCache(tenantId);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'supplier.deactivated',
    entityType: 'supplier',
    entityId: supplier.id,
    entityName: supplier.name,
    metadata: { code: supplier.code },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});
}

export async function linkProductToSupplier(
  tenantId: string,
  supplierId: string,
  data: LinkSupplierProductBody
): Promise<unknown> {
  const [supplier, product] = await Promise.all([
    SupplierModel.findOne({ _id: supplierId, tenantId, isActive: true }).select('_id currency leadTimeDays'),
    Product.findOne({ _id: data.productId, tenantId, isActive: true }).select('_id')
  ]);

  if (!supplier) {
    throw new ApiError(404, 'Supplier not found');
  }
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const existing = await SupplierProductModel.findOne({ tenantId, supplierId, productId: data.productId }).select('_id');
  if (existing) {
    throw new ApiError(409, 'Product already linked to this supplier');
  }

  if (data.isPreferred === true) {
    await SupplierProductModel.updateMany(
      { tenantId, productId: data.productId, isPreferred: true },
      { $set: { isPreferred: false } }
    );
  }

  const link = await SupplierProductModel.create({
    tenantId,
    supplierId,
    productId: data.productId,
    supplierSku: data.supplierSku ?? '',
    unitCost: data.unitCost,
    currency: data.currency ?? supplier.currency,
    minimumOrderQty: data.minimumOrderQty ?? 1,
    leadTimeDays: data.leadTimeDays ?? supplier.leadTimeDays,
    isPreferred: data.isPreferred ?? false,
    notes: data.notes ?? ''
  });

  return link;
}

export async function updateSupplierProduct(
  tenantId: string,
  supplierId: string,
  productId: string,
  data: UpdateSupplierProductBody
): Promise<unknown> {
  const link = await SupplierProductModel.findOne({ tenantId, supplierId, productId });
  if (!link) {
    throw new ApiError(404, 'Supplier-product link not found');
  }

  if (data.isPreferred === true) {
    await SupplierProductModel.updateMany(
      {
        tenantId,
        productId,
        _id: { $ne: link._id },
        isPreferred: true
      },
      { $set: { isPreferred: false } }
    );
  }

  if (data.supplierSku !== undefined) link.supplierSku = data.supplierSku;
  if (data.unitCost !== undefined) link.unitCost = data.unitCost;
  if (data.currency !== undefined) link.currency = data.currency;
  if (data.minimumOrderQty !== undefined) link.minimumOrderQty = data.minimumOrderQty;
  if (data.leadTimeDays !== undefined) link.leadTimeDays = data.leadTimeDays;
  if (data.isPreferred !== undefined) link.isPreferred = data.isPreferred;
  if (data.notes !== undefined) link.notes = data.notes;

  await link.save();
  return link;
}

export async function unlinkProductFromSupplier(tenantId: string, supplierId: string, productId: string): Promise<void> {
  const result = await SupplierProductModel.findOneAndDelete({ tenantId, supplierId, productId });
  if (!result) {
    throw new ApiError(404, 'Supplier-product link not found');
  }
}

export async function getProductSuppliers(tenantId: string, productId: string): Promise<{ suppliers: unknown[] }> {
  const product = await Product.findOne({ _id: productId, tenantId }).select('_id');
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const suppliers = await SupplierProductModel.find({ tenantId, productId })
    .populate('supplierId', 'name code email leadTimeDays currency')
    .sort({ isPreferred: -1, unitCost: 1 })
    .lean();

  return { suppliers };
}

export async function getSupplierProducts(tenantId: string, supplierId: string): Promise<{ links: unknown[] }> {
  const supplier = await SupplierModel.findOne({ _id: supplierId, tenantId }).select('_id');
  if (!supplier) {
    throw new ApiError(404, 'Supplier not found');
  }

  const links = await SupplierProductModel.find({ tenantId, supplierId })
    .populate('productId', 'name sku unit categoryId')
    .sort({ isPreferred: -1, updatedAt: -1 })
    .lean();

  return { links };
}

export async function getSuppliersDropdown(tenantId: string): Promise<{ suppliers: unknown[] }> {
  const cacheKey = `suppliers:dropdown:${tenantId}`;
  const cached = await getCache<unknown[]>(cacheKey);
  if (cached) {
    return { suppliers: cached };
  }

  const suppliers = await SupplierModel.find({ tenantId, isActive: true })
    .select('_id name code currency leadTimeDays paymentTerms')
    .sort({ name: 1 })
    .lean();

  await setCache(cacheKey, suppliers, 300);
  return { suppliers };
}
