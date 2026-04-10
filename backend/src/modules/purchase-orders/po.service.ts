import mongoose from 'mongoose';
import { getCache, setCache, deleteCache } from '../../config/redis';
import { Product } from '../../models/Product';
import { PurchaseOrderModel, type IPOLineItem } from '../../models/PurchaseOrder';
import { SupplierModel } from '../../models/Supplier';
import { WarehouseModel } from '../../models/Warehouse';
import { enqueuePOEmail } from '../../queues/jobs/emailNotification.job';
import { enqueueProductUpsert } from '../../queues/jobs/searchSync.job';
import { ApiError } from '../../utils/ApiError';
import { createAuditLog, diffObjects, type AuditContext } from '../../utils/audit';
import { triggerStatsRefresh } from '../dashboard/dashboard.service';
import { recordIn } from '../stock/stock.service';
import { invalidateWarehouseCache } from '../warehouses/warehouses.service';
import type { CancelPOBody, CreatePOBody, ListPOsQuery, ReceiveItemsBody, UpdatePOBody } from './po.schema';

interface ListPOResult {
  orders: unknown[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface ReceivePOResult {
  order: unknown;
  movements: unknown[];
}

interface POStats {
  totalDraft: number;
  totalSent: number;
  totalPartial: number;
  totalReceived: number;
  totalPending: number;
  pendingValue: number;
  thisMonthValue: number;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString('base64');
}

function parseCursor(cursor: string): { createdAt: Date; id: mongoose.Types.ObjectId } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as { createdAt?: string; id?: string };
    if (!parsed.createdAt || !parsed.id || !mongoose.Types.ObjectId.isValid(parsed.id)) {
      return null;
    }

    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return {
      createdAt,
      id: new mongoose.Types.ObjectId(parsed.id)
    };
  } catch {
    return null;
  }
}

async function invalidatePOStatsCache(tenantId: string): Promise<void> {
  await deleteCache(`po:stats:${tenantId}`);
}

export async function generatePONumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `PO-${year}-`;

  const lastPO = await PurchaseOrderModel.findOne({
    tenantId,
    poNumber: { $regex: `^${escapeRegex(yearPrefix)}` }
  })
    .sort({ poNumber: -1 })
    .select('poNumber')
    .lean();

  const lastSeq = lastPO?.poNumber ? parseInt(lastPO.poNumber.split('-')[2] ?? '0', 10) || 0 : 0;
  return `${yearPrefix}${String(lastSeq + 1).padStart(4, '0')}`;
}

export async function listPOs(tenantId: string, query: ListPOsQuery): Promise<ListPOResult> {
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
  const filter: Record<string, unknown> = {
    tenantId: new mongoose.Types.ObjectId(tenantId)
  };

  if (query.status === 'OPEN') {
    filter.status = { $in: ['DRAFT', 'SENT', 'PARTIAL'] };
  } else if (query.status) {
    filter.status = query.status;
  }

  if (query.supplierId) filter.supplierId = new mongoose.Types.ObjectId(query.supplierId);
  if (query.warehouseId) filter.warehouseId = new mongoose.Types.ObjectId(query.warehouseId);

  if (query.dateFrom || query.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (query.dateFrom) dateFilter.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    filter.createdAt = dateFilter;
  }

  if (query.search) {
    const searchRegex = { $regex: escapeRegex(query.search), $options: 'i' };
    filter.$or = [{ poNumber: searchRegex }, { supplierName: searchRegex }, { notes: searchRegex }];
  }

  const parsedCursor = query.cursor ? parseCursor(query.cursor) : null;
  if (query.cursor && !parsedCursor) {
    throw new ApiError(400, 'Invalid cursor');
  }

  if (parsedCursor) {
    filter.$and = [
      {
        $or: [
          { createdAt: { $lt: parsedCursor.createdAt } },
          { createdAt: parsedCursor.createdAt, _id: { $lt: parsedCursor.id } }
        ]
      }
    ];
  }

  const orders = await PurchaseOrderModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = orders.length > limit;
  if (hasMore) {
    orders.pop();
  }

  const last = orders[orders.length - 1];
  const nextCursor = hasMore && last ? buildCursor(last.createdAt, String(last._id)) : null;

  return { orders, nextCursor, hasMore };
}

export async function getPO(tenantId: string, poId: string): Promise<unknown> {
  const order = await PurchaseOrderModel.findOne({ _id: poId, tenantId })
    .populate('supplierId', 'name code email phone currency paymentTerms')
    .populate('warehouseId', 'name code')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .lean();

  if (!order) {
    throw new ApiError(404, 'Purchase order not found');
  }

  return order;
}

async function buildLineItems(tenantId: string, lineItemsInput: CreatePOBody['lineItems']): Promise<IPOLineItem[]> {
  const productIds = lineItemsInput.map((item) => item.productId);

  const products = await Product.find({ tenantId, _id: { $in: productIds } })
    .select('_id name sku unit')
    .lean();

  if (products.length !== productIds.length) {
    throw new ApiError(400, 'One or more products not found');
  }

  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return lineItemsInput.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new ApiError(400, 'One or more products not found');
    }

    return {
      productId: new mongoose.Types.ObjectId(item.productId),
      productName: String(product.name),
      productSku: String(product.sku),
      unit: String(product.unit),
      orderedQty: item.orderedQty,
      receivedQty: 0,
      unitCost: roundTo2(item.unitCost),
      totalCost: roundTo2(item.orderedQty * item.unitCost),
      notes: item.notes ?? ''
    };
  });
}

function computeFinancials(lineItems: IPOLineItem[], taxRate = 0, shippingCost = 0): {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
} {
  const subtotal = roundTo2(lineItems.reduce((sum, item) => sum + item.totalCost, 0));
  const taxAmount = roundTo2((subtotal * taxRate) / 100);
  const totalAmount = roundTo2(subtotal + taxAmount + shippingCost);

  return { subtotal, taxAmount, totalAmount };
}

export async function createPO(
  tenantId: string,
  userId: string,
  data: CreatePOBody,
  auditCtx: AuditContext
): Promise<unknown> {
  const [supplier, warehouse] = await Promise.all([
    SupplierModel.findOne({ _id: data.supplierId, tenantId, isActive: true }).select('name currency'),
    WarehouseModel.findOne({ _id: data.warehouseId, tenantId, isActive: true }).select('name')
  ]);

  if (!supplier) {
    throw new ApiError(404, 'Supplier not found');
  }
  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found');
  }

  const lineItems = await buildLineItems(tenantId, data.lineItems);
  const taxRate = data.taxRate ?? 0;
  const shippingCost = roundTo2(data.shippingCost ?? 0);
  const { subtotal, taxAmount, totalAmount } = computeFinancials(lineItems, taxRate, shippingCost);

  let order: unknown = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const poNumber = await generatePONumber(tenantId);
      order = await PurchaseOrderModel.create({
        tenantId,
        poNumber,
        supplierId: data.supplierId,
        supplierName: supplier.name,
        warehouseId: data.warehouseId,
        warehouseName: warehouse.name,
        status: 'DRAFT',
        lineItems,
        subtotal,
        taxRate,
        taxAmount,
        shippingCost,
        totalAmount,
        currency: supplier.currency,
        orderDate: new Date(),
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        receivedDate: null,
        notes: data.notes ?? '',
        supplierReference: data.supplierReference ?? '',
        attachmentUrls: [],
        createdBy: userId,
        updatedBy: userId
      });
      break;
    } catch (error: unknown) {
      const mongoError = error as { code?: number; keyPattern?: Record<string, number> };
      const isDuplicatePoNumber = mongoError.code === 11000 && Boolean(mongoError.keyPattern?.poNumber);

      if (!isDuplicatePoNumber) {
        throw error;
      }
      lastError = error;
    }
  }

  if (!order) {
    throw (lastError ?? new ApiError(500, 'Failed to generate unique PO number'));
  }

  await SupplierModel.findByIdAndUpdate(data.supplierId, {
    $inc: { totalOrders: 1, totalOrderValue: totalAmount },
    $set: { lastOrderDate: new Date() }
  });

  await invalidatePOStatsCache(tenantId);

  const createdOrder = order as { id: string; poNumber: string };

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'po.created',
    entityType: 'purchase_order',
    entityId: createdOrder.id,
    entityName: createdOrder.poNumber,
    metadata: {
      supplierName: supplier.name,
      totalAmount
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return order;
}

export async function updatePO(
  tenantId: string,
  poId: string,
  userId: string,
  data: UpdatePOBody,
  auditCtx: AuditContext
): Promise<unknown> {
  const order = await PurchaseOrderModel.findOne({ _id: poId, tenantId });
  if (!order) {
    throw new ApiError(404, 'Purchase order not found');
  }

  if (order.status !== 'DRAFT') {
    throw new ApiError(400, 'Purchase order can only be edited while in DRAFT status');
  }

  const before = order.toObject();

  if (data.supplierId) {
    const supplier = await SupplierModel.findOne({ _id: data.supplierId, tenantId, isActive: true }).select('name currency');
    if (!supplier) {
      throw new ApiError(404, 'Supplier not found');
    }
    order.supplierId = new mongoose.Types.ObjectId(data.supplierId);
    order.supplierName = supplier.name;
    order.currency = supplier.currency;
  }

  if (data.warehouseId) {
    const warehouse = await WarehouseModel.findOne({ _id: data.warehouseId, tenantId, isActive: true }).select('name');
    if (!warehouse) {
      throw new ApiError(404, 'Warehouse not found');
    }
    order.warehouseId = new mongoose.Types.ObjectId(data.warehouseId);
    order.warehouseName = warehouse.name;
  }

  if (data.lineItems) {
    order.lineItems = await buildLineItems(tenantId, data.lineItems);
  }

  if (data.taxRate !== undefined) order.taxRate = data.taxRate;
  if (data.shippingCost !== undefined) order.shippingCost = roundTo2(data.shippingCost);
  if (data.expectedDeliveryDate !== undefined) {
    order.expectedDeliveryDate = data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null;
  }
  if (data.notes !== undefined) order.notes = data.notes;
  if (data.supplierReference !== undefined) order.supplierReference = data.supplierReference;

  const { subtotal, taxAmount, totalAmount } = computeFinancials(order.lineItems, order.taxRate, order.shippingCost);
  order.subtotal = subtotal;
  order.taxAmount = taxAmount;
  order.totalAmount = totalAmount;
  order.updatedBy = new mongoose.Types.ObjectId(userId);

  await order.save();
  await invalidatePOStatsCache(tenantId);

  const changes = diffObjects(
    before as unknown as Record<string, unknown>,
    order.toObject() as unknown as Record<string, unknown>
  );

  if (changes.length > 0) {
    createAuditLog({
      tenantId,
      performedBy: userId,
      performedByName: auditCtx.performedByName,
      performedByEmail: auditCtx.performedByEmail,
      action: 'po.updated',
      entityType: 'purchase_order',
      entityId: order.id,
      entityName: order.poNumber,
      changes,
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent
    }).catch(() => {});
  }

  return order;
}

export async function sendPO(
  tenantId: string,
  poId: string,
  userId: string,
  sendEmail: boolean,
  auditCtx: AuditContext
): Promise<unknown> {
  const order = await PurchaseOrderModel.findOne({ _id: poId, tenantId }).populate('supplierId', 'email');
  if (!order) {
    throw new ApiError(404, 'Purchase order not found');
  }

  if (order.status !== 'DRAFT') {
    throw new ApiError(400, 'Only DRAFT orders can be sent');
  }
  if (order.lineItems.length === 0) {
    throw new ApiError(400, 'Cannot send an empty purchase order');
  }

  order.status = 'SENT';
  order.orderDate = new Date();
  order.updatedBy = new mongoose.Types.ObjectId(userId);
  await order.save();

  if (sendEmail) {
    const supplierEmail = (order.supplierId as unknown as { email?: string })?.email;
    if (supplierEmail) {
      await enqueuePOEmail(tenantId, String(order._id));
    }
  }

  await invalidatePOStatsCache(tenantId);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'po.sent',
    entityType: 'purchase_order',
    entityId: order.id,
    entityName: order.poNumber,
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return order;
}

export async function receiveItems(
  tenantId: string,
  poId: string,
  userId: string,
  data: ReceiveItemsBody,
  auditCtx: AuditContext
): Promise<ReceivePOResult> {
  const order = await PurchaseOrderModel.findOne({ _id: poId, tenantId });
  if (!order) {
    throw new ApiError(404, 'Purchase order not found');
  }

  if (order.status === 'CANCELLED') {
    throw new ApiError(400, 'Cannot receive items on a cancelled order');
  }
  if (order.status === 'RECEIVED') {
    throw new ApiError(400, 'This order has already been fully received');
  }
  if (order.status === 'DRAFT') {
    throw new ApiError(400, 'Order must be sent before receiving items');
  }

  for (const incomingItem of data.lineItems) {
    const lineItem = order.lineItems.find((line) => String(line.productId) === incomingItem.productId);
    if (!lineItem) {
      throw new ApiError(400, `Product ${incomingItem.productId} is not in this purchase order`);
    }

    const remaining = lineItem.orderedQty - lineItem.receivedQty;
    if (incomingItem.receivedQty > remaining) {
      throw new ApiError(
        400,
        `Cannot receive ${incomingItem.receivedQty} — only ${remaining} remaining for ${lineItem.productSku}`
      );
    }
  }

  const session = await mongoose.startSession();
  const movements: unknown[] = [];

  try {
    session.startTransaction();

    for (const incomingItem of data.lineItems) {
      const lineItem = order.lineItems.find((line) => String(line.productId) === incomingItem.productId);
      if (!lineItem || incomingItem.receivedQty <= 0) {
        continue;
      }

      lineItem.receivedQty += incomingItem.receivedQty;

      const movement = await recordIn(
        tenantId,
        userId,
        {
          productId: incomingItem.productId,
          warehouseId: String(order.warehouseId),
          quantity: incomingItem.receivedQty,
          referenceType: 'PURCHASE',
          referenceId: String(order._id),
          note: `PO ${order.poNumber} - received ${incomingItem.receivedQty} units`
        },
        auditCtx,
        { session }
      );

      movements.push(movement);
    }

    const allReceived = order.lineItems.every((line) => line.receivedQty >= line.orderedQty);
    const someReceived = order.lineItems.some((line) => line.receivedQty > 0);
    const newStatus = allReceived ? 'RECEIVED' : someReceived ? 'PARTIAL' : order.status;

    order.status = newStatus;
    if (newStatus === 'RECEIVED') {
      order.receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
    }
    order.updatedBy = new mongoose.Types.ObjectId(userId);

    await order.save({ session });
    await session.commitTransaction();

    await Promise.allSettled([
      invalidatePOStatsCache(tenantId),
      invalidateWarehouseCache(tenantId),
      triggerStatsRefresh(tenantId),
      ...data.lineItems.map((item) => enqueueProductUpsert(item.productId, tenantId))
    ]);

    createAuditLog({
      tenantId,
      performedBy: userId,
      performedByName: auditCtx.performedByName,
      performedByEmail: auditCtx.performedByEmail,
      action: order.status === 'RECEIVED' ? 'po.received' : 'po.partial_received',
      entityType: 'purchase_order',
      entityId: order.id,
      entityName: order.poNumber,
      metadata: {
        receivedItems: data.lineItems.map((item) => ({ productId: item.productId, receivedQty: item.receivedQty }))
      },
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent
    }).catch(() => {});

    return { order, movements };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function cancelPO(
  tenantId: string,
  poId: string,
  userId: string,
  data: CancelPOBody,
  auditCtx: AuditContext
): Promise<unknown> {
  const order = await PurchaseOrderModel.findOne({ _id: poId, tenantId });
  if (!order) {
    throw new ApiError(404, 'Purchase order not found');
  }

  if (order.status === 'RECEIVED') {
    throw new ApiError(400, 'Cannot cancel a fully received order');
  }
  if (order.status === 'CANCELLED') {
    throw new ApiError(400, 'Order is already cancelled');
  }

  const previousStatus = order.status;
  order.status = 'CANCELLED';
  order.updatedBy = new mongoose.Types.ObjectId(userId);

  if (order.notes.trim().length === 0 && previousStatus === 'PARTIAL') {
    order.notes = 'Cancelled with partial receipt. Stock already received is retained.';
  }

  await order.save();
  await invalidatePOStatsCache(tenantId);

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'po.cancelled',
    entityType: 'purchase_order',
    entityId: order.id,
    entityName: order.poNumber,
    metadata: {
      reason: data.reason ?? ''
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  return order;
}

export async function getPOStats(tenantId: string): Promise<POStats> {
  const cacheKey = `po:stats:${tenantId}`;
  const cached = await getCache<POStats>(cacheKey);
  if (cached) {
    return cached;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [counts, pendingValueRaw, thisMonthValueRaw] = await Promise.all([
    PurchaseOrderModel.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    PurchaseOrderModel.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          status: { $in: ['DRAFT', 'SENT', 'PARTIAL'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    PurchaseOrderModel.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          status: 'RECEIVED',
          receivedDate: { $gte: monthStart }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ])
  ]);

  const countMap = new Map((counts as Array<{ _id: string; count: number }>).map((row) => [row._id, row.count]));

  const totalDraft = countMap.get('DRAFT') ?? 0;
  const totalSent = countMap.get('SENT') ?? 0;
  const totalPartial = countMap.get('PARTIAL') ?? 0;

  const totalReceived = await PurchaseOrderModel.countDocuments({
    tenantId,
    status: 'RECEIVED',
    createdAt: { $gte: thirtyDaysAgo }
  });

  const stats: POStats = {
    totalDraft,
    totalSent,
    totalPartial,
    totalReceived,
    totalPending: totalDraft + totalSent + totalPartial,
    pendingValue: roundTo2(Number(pendingValueRaw[0]?.total ?? 0)),
    thisMonthValue: roundTo2(Number(thisMonthValueRaw[0]?.total ?? 0))
  };

  await setCache(cacheKey, stats, 300);
  return stats;
}
