import mongoose, { type ClientSession } from 'mongoose';
import { CACHE_KEYS, deleteCache, getCache, setCache } from '../../config/redis';
import { getIO } from '../../config/socket';
import { Product, type IProduct } from '../../models/Product';
import { StockAlertModel, type IStockAlert } from '../../models/StockAlert';
import { StockMovementModel, type IStockMovement } from '../../models/StockMovement';
import { WarehouseModel, type IWarehouse } from '../../models/Warehouse';
import { WarehouseStockModel, type IWarehouseStock } from '../../models/WarehouseStock';
import { enqueueAlertCheck } from '../../queues/jobs/alertCheck.job';
import { enqueueProductUpsert } from '../../queues/jobs/searchSync.job';
import { ApiError } from '../../utils/ApiError';
import { invalidateWarehouseCache } from '../warehouses/warehouses.service';
import { invalidateDashboardActivityCache, triggerStatsRefresh } from '../dashboard/dashboard.service';
import { createAuditLog, type AuditContext } from '../../utils/audit';

interface BaseMovementInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  note?: string;
  referenceId?: string;
}

interface RecordInInput extends BaseMovementInput {
  referenceType?: 'MANUAL' | 'PURCHASE';
}

interface RecordOutInput extends BaseMovementInput {
  referenceType?: 'MANUAL' | 'SALE';
}

interface RecordAdjustmentInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  note?: string;
}

interface RecordWasteInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  note?: string;
}

interface RecordTransferInput {
  productId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  quantity: number;
  note?: string;
}

interface ListMovementsQuery {
  cursor?: string;
  limit?: number;
  productId?: string;
  warehouseId?: string;
  type?: 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE' | 'TRANSFER_OUT' | 'TRANSFER_IN';
  performedBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface ListAlertsQuery {
  status?: 'PENDING' | 'ACKNOWLEDGED';
  productId?: string;
  cursor?: string;
  limit?: number;
}

const toObjectId = (id: string): mongoose.Types.ObjectId => new mongoose.Types.ObjectId(id);

const emitStockEvent = (tenantId: string, event: string, data: unknown): void => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit(event, data);
  } catch {
    // best effort side effect
  }
};

const runPostCommitSideEffects = async (tasks: Array<Promise<unknown>>): Promise<void> => {
  const results = await Promise.allSettled(tasks);
  const rejected = results.filter((result) => result.status === 'rejected');

  if (rejected.length > 0) {
    // Side effects are intentionally non-blocking for successful transactional writes.
  }
};

const safeAbortTransaction = async (session: ClientSession): Promise<void> => {
  if (!session.inTransaction()) {
    return;
  }

  try {
    await session.abortTransaction();
  } catch {
    // Preserve original error path if abort itself fails.
  }
};

async function getOrCreateWarehouseStock(
  session: ClientSession,
  tenantId: string,
  warehouseId: string,
  productId: string,
  lowStockThreshold?: number
): Promise<IWarehouseStock> {
  const ws = await WarehouseStockModel.findOneAndUpdate(
    { tenantId, warehouseId, productId },
    {
      $setOnInsert: {
        tenantId,
        warehouseId,
        productId,
        quantity: 0,
        lowStockThreshold: lowStockThreshold ?? 0,
        reservedQuantity: 0
      }
    },
    { upsert: true, new: true, session }
  );

  if (!ws) {
    throw new ApiError(500, 'Failed to initialize warehouse stock');
  }

  return ws;
}

async function verifyProductAndWarehouse(
  session: ClientSession,
  tenantId: string,
  productId: string,
  warehouseId: string
): Promise<{ product: IProduct; warehouse: IWarehouse }> {
  // Do not run parallel operations within a transaction session.
  const product = await Product.findOne({ _id: productId, tenantId }).session(session);
  const warehouse = await WarehouseModel.findOne({ _id: warehouseId, tenantId }).session(session);

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  if (!warehouse) {
    throw new ApiError(404, 'Warehouse not found');
  }
  if (!product.isActive) {
    throw new ApiError(400, 'Product is inactive');
  }
  if (!warehouse.isActive) {
    throw new ApiError(400, 'Warehouse is inactive');
  }

  return { product, warehouse };
}

function logStockMutationAudit(params: {
  tenantId: string;
  userId: string;
  auditCtx: AuditContext;
  product: IProduct;
  actionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE' | 'TRANSFER';
  metadata: Record<string, unknown>;
}): void {
  createAuditLog({
    tenantId: params.tenantId,
    performedBy: params.userId,
    performedByName: params.auditCtx.performedByName,
    performedByEmail: params.auditCtx.performedByEmail,
    action: 'stock.adjusted',
    entityType: 'stock',
    entityId: params.product._id.toString(),
    entityName: `${params.product.name} (${params.product.sku})`,
    metadata: {
      movementType: params.actionType,
      ...params.metadata
    },
    ipAddress: params.auditCtx.ipAddress,
    userAgent: params.auditCtx.userAgent
  }).catch(() => {});
}

export async function recordIn(
  tenantId: string,
  userId: string,
  data: RecordInInput,
  auditCtx: AuditContext
): Promise<IStockMovement> {
  const session = await mongoose.startSession();
  let movement: IStockMovement | null = null;
  let auditSnapshot:
    | {
        product: IProduct;
        warehouse: IWarehouse;
        quantityBefore: number;
        quantityAfter: number;
      }
    | undefined;

  try {
    session.startTransaction();

    const { product, warehouse } = await verifyProductAndWarehouse(session, tenantId, data.productId, data.warehouseId);
    const warehouseStock = await getOrCreateWarehouseStock(session, tenantId, data.warehouseId, data.productId, product.lowStockThreshold);

    const quantityBefore = warehouseStock.quantity;
    const quantityAfter = quantityBefore + data.quantity;
    const totalStockBefore = product.totalStock;
    const totalStockAfter = totalStockBefore + data.quantity;

    auditSnapshot = {
      product,
      warehouse,
      quantityBefore,
      quantityAfter
    };

    const created = await StockMovementModel.create(
      [
        {
          tenantId,
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: 'IN',
          quantity: data.quantity,
          quantityBefore,
          quantityAfter,
          totalStockBefore,
          totalStockAfter,
          referenceType: data.referenceType ?? 'MANUAL',
          referenceId: data.referenceId ? toObjectId(data.referenceId) : null,
          note: data.note ?? '',
          performedBy: userId,
          transferPairId: null
        }
      ],
      { session }
    );
    movement = created[0];

    await WarehouseStockModel.findOneAndUpdate(
      { tenantId, warehouseId: data.warehouseId, productId: data.productId },
      { $inc: { quantity: data.quantity }, $set: { updatedAt: new Date() } },
      { session }
    );

    await Product.findByIdAndUpdate(data.productId, { $inc: { totalStock: data.quantity } }, { session });

    await session.commitTransaction();

    await runPostCommitSideEffects([
      enqueueAlertCheck(tenantId, data.productId, data.warehouseId),
      invalidateWarehouseCache(tenantId),
      triggerStatsRefresh(tenantId),
      invalidateDashboardActivityCache(tenantId),
      enqueueProductUpsert(data.productId, tenantId),
      Promise.resolve(
        emitStockEvent(tenantId, 'stock:updated', {
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: 'IN',
          quantityAfter,
          totalStockAfter
        })
      )
    ]);

    if (auditSnapshot) {
      logStockMutationAudit({
        tenantId,
        userId,
        auditCtx,
        product: auditSnapshot.product,
        actionType: 'IN',
        metadata: {
          warehouseId: data.warehouseId,
          warehouseName: auditSnapshot.warehouse.name,
          quantity: data.quantity,
          quantityBefore: auditSnapshot.quantityBefore,
          quantityAfter: auditSnapshot.quantityAfter,
          referenceType: data.referenceType ?? 'MANUAL',
          note: data.note ?? ''
        }
      });
    }

    return movement;
  } catch (error) {
    await safeAbortTransaction(session);
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function recordOut(
  tenantId: string,
  userId: string,
  data: RecordOutInput,
  auditCtx: AuditContext
): Promise<IStockMovement> {
  const preStock = await WarehouseStockModel.findOne({
    tenantId,
    warehouseId: data.warehouseId,
    productId: data.productId
  })
    .select('quantity')
    .lean();

  if ((preStock?.quantity ?? 0) < data.quantity) {
    const product = await Product.findOne({ _id: data.productId, tenantId }).select('unit').lean();
    throw new ApiError(
      400,
      `Insufficient stock. Available: ${preStock?.quantity ?? 0} ${product?.unit ?? ''}, requested: ${data.quantity}`.trim()
    );
  }

  const session = await mongoose.startSession();
  let auditSnapshot:
    | {
        product: IProduct;
        warehouse: IWarehouse;
        quantityBefore: number;
        quantityAfter: number;
      }
    | undefined;
  try {
    session.startTransaction();

    const { product, warehouse } = await verifyProductAndWarehouse(session, tenantId, data.productId, data.warehouseId);
    const warehouseStock = await getOrCreateWarehouseStock(session, tenantId, data.warehouseId, data.productId, product.lowStockThreshold);

    if (warehouseStock.quantity < data.quantity) {
      throw new ApiError(400, `Insufficient stock. Available: ${warehouseStock.quantity} ${product.unit}, requested: ${data.quantity}`);
    }

    const quantityBefore = warehouseStock.quantity;
    const quantityAfter = quantityBefore - data.quantity;
    const totalStockBefore = product.totalStock;
    const totalStockAfter = totalStockBefore - data.quantity;

    auditSnapshot = {
      product,
      warehouse,
      quantityBefore,
      quantityAfter
    };

    const created = await StockMovementModel.create(
      [
        {
          tenantId,
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: 'OUT',
          quantity: data.quantity,
          quantityBefore,
          quantityAfter,
          totalStockBefore,
          totalStockAfter,
          referenceType: data.referenceType ?? 'MANUAL',
          referenceId: data.referenceId ? toObjectId(data.referenceId) : null,
          note: data.note ?? '',
          performedBy: userId,
          transferPairId: null
        }
      ],
      { session }
    );

    await WarehouseStockModel.findOneAndUpdate(
      { tenantId, warehouseId: data.warehouseId, productId: data.productId },
      { $inc: { quantity: -data.quantity }, $set: { updatedAt: new Date() } },
      { session }
    );

    await Product.findByIdAndUpdate(data.productId, { $inc: { totalStock: -data.quantity } }, { session });

    await session.commitTransaction();

    await runPostCommitSideEffects([
      enqueueAlertCheck(tenantId, data.productId, data.warehouseId),
      invalidateWarehouseCache(tenantId),
      triggerStatsRefresh(tenantId),
      invalidateDashboardActivityCache(tenantId),
      enqueueProductUpsert(data.productId, tenantId),
      Promise.resolve(
        emitStockEvent(tenantId, 'stock:updated', {
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: 'OUT',
          quantityAfter,
          totalStockAfter
        })
      )
    ]);

    if (auditSnapshot) {
      logStockMutationAudit({
        tenantId,
        userId,
        auditCtx,
        product: auditSnapshot.product,
        actionType: 'OUT',
        metadata: {
          warehouseId: data.warehouseId,
          warehouseName: auditSnapshot.warehouse.name,
          quantity: data.quantity,
          quantityBefore: auditSnapshot.quantityBefore,
          quantityAfter: auditSnapshot.quantityAfter,
          referenceType: data.referenceType ?? 'MANUAL',
          note: data.note ?? ''
        }
      });
    }

    return created[0];
  } catch (error) {
    await safeAbortTransaction(session);
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function recordAdjustment(
  tenantId: string,
  userId: string,
  data: RecordAdjustmentInput,
  auditCtx: AuditContext
): Promise<IStockMovement> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { product, warehouse } = await verifyProductAndWarehouse(session, tenantId, data.productId, data.warehouseId);
    const warehouseStock = await getOrCreateWarehouseStock(session, tenantId, data.warehouseId, data.productId, product.lowStockThreshold);

    if (data.quantity < 0 && warehouseStock.quantity + data.quantity < 0) {
      throw new ApiError(
        400,
        `Adjustment would result in negative stock. Current: ${warehouseStock.quantity}, adjustment: ${data.quantity}, result would be: ${warehouseStock.quantity + data.quantity}`
      );
    }

    const quantityBefore = warehouseStock.quantity;
    const quantityAfter = quantityBefore + data.quantity;
    const totalStockBefore = product.totalStock;
    const totalStockAfter = totalStockBefore + data.quantity;

    const created = await StockMovementModel.create(
      [
        {
          tenantId,
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: 'ADJUSTMENT',
          quantity: data.quantity,
          quantityBefore,
          quantityAfter,
          totalStockBefore,
          totalStockAfter,
          referenceType: 'ADJUSTMENT',
          referenceId: null,
          note: data.note ?? '',
          performedBy: userId,
          transferPairId: null
        }
      ],
      { session }
    );

    await WarehouseStockModel.findOneAndUpdate(
      { tenantId, warehouseId: data.warehouseId, productId: data.productId },
      { $inc: { quantity: data.quantity }, $set: { updatedAt: new Date() } },
      { session }
    );

    await Product.findByIdAndUpdate(data.productId, { $inc: { totalStock: data.quantity } }, { session });

    await session.commitTransaction();

    await runPostCommitSideEffects([
      enqueueAlertCheck(tenantId, data.productId, data.warehouseId),
      invalidateWarehouseCache(tenantId),
      triggerStatsRefresh(tenantId),
      invalidateDashboardActivityCache(tenantId),
      enqueueProductUpsert(data.productId, tenantId),
      Promise.resolve(
        emitStockEvent(tenantId, 'stock:updated', {
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: 'ADJUSTMENT',
          quantityAfter,
          totalStockAfter
        })
      )
    ]);

    createAuditLog({
      tenantId,
      performedBy: userId,
      performedByName: auditCtx.performedByName,
      performedByEmail: auditCtx.performedByEmail,
      action: 'stock.adjusted',
      entityType: 'stock',
      entityId: product._id.toString(),
      entityName: `${product.name} (${product.sku})`,
      metadata: {
        warehouseId: data.warehouseId,
        warehouseName: warehouse.name,
        quantity: data.quantity,
        quantityBefore,
        quantityAfter
      },
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent
    }).catch(() => {});

    return created[0];
  } catch (error) {
    await safeAbortTransaction(session);
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function recordWaste(
  tenantId: string,
  userId: string,
  data: RecordWasteInput,
  auditCtx: AuditContext
): Promise<IStockMovement> {
  const preStock = await WarehouseStockModel.findOne({
    tenantId,
    warehouseId: data.warehouseId,
    productId: data.productId
  })
    .select('quantity')
    .lean();

  if ((preStock?.quantity ?? 0) < data.quantity) {
    throw new ApiError(400, 'Insufficient stock to record waste.');
  }

  const session = await mongoose.startSession();
  let auditSnapshot:
    | {
        product: IProduct;
        warehouse: IWarehouse;
        quantityBefore: number;
        quantityAfter: number;
      }
    | undefined;
  try {
    session.startTransaction();

    const { product, warehouse } = await verifyProductAndWarehouse(session, tenantId, data.productId, data.warehouseId);
    const warehouseStock = await getOrCreateWarehouseStock(session, tenantId, data.warehouseId, data.productId, product.lowStockThreshold);

    if (warehouseStock.quantity < data.quantity) {
      throw new ApiError(400, 'Insufficient stock to record waste.');
    }

    const quantityBefore = warehouseStock.quantity;
    const quantityAfter = quantityBefore - data.quantity;
    const totalStockBefore = product.totalStock;
    const totalStockAfter = totalStockBefore - data.quantity;

    auditSnapshot = {
      product,
      warehouse,
      quantityBefore,
      quantityAfter
    };

    const created = await StockMovementModel.create(
      [
        {
          tenantId,
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: 'WASTE',
          quantity: data.quantity,
          quantityBefore,
          quantityAfter,
          totalStockBefore,
          totalStockAfter,
          referenceType: 'WASTE',
          referenceId: null,
          note: data.note ?? '',
          performedBy: userId,
          transferPairId: null
        }
      ],
      { session }
    );

    await WarehouseStockModel.findOneAndUpdate(
      { tenantId, warehouseId: data.warehouseId, productId: data.productId },
      { $inc: { quantity: -data.quantity }, $set: { updatedAt: new Date() } },
      { session }
    );

    await Product.findByIdAndUpdate(data.productId, { $inc: { totalStock: -data.quantity } }, { session });

    await session.commitTransaction();

    await runPostCommitSideEffects([
      enqueueAlertCheck(tenantId, data.productId, data.warehouseId),
      invalidateWarehouseCache(tenantId),
      triggerStatsRefresh(tenantId),
      invalidateDashboardActivityCache(tenantId),
      enqueueProductUpsert(data.productId, tenantId),
      Promise.resolve(
        emitStockEvent(tenantId, 'stock:updated', {
          productId: data.productId,
          warehouseId: data.warehouseId,
          type: 'WASTE',
          quantityAfter,
          totalStockAfter
        })
      )
    ]);

    if (auditSnapshot) {
      logStockMutationAudit({
        tenantId,
        userId,
        auditCtx,
        product: auditSnapshot.product,
        actionType: 'WASTE',
        metadata: {
          warehouseId: data.warehouseId,
          warehouseName: auditSnapshot.warehouse.name,
          quantity: data.quantity,
          quantityBefore: auditSnapshot.quantityBefore,
          quantityAfter: auditSnapshot.quantityAfter,
          note: data.note ?? ''
        }
      });
    }

    return created[0];
  } catch (error) {
    await safeAbortTransaction(session);
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function recordTransfer(
  tenantId: string,
  userId: string,
  data: RecordTransferInput,
  auditCtx: AuditContext
): Promise<{ out: IStockMovement; in: IStockMovement }> {
  const preSource = await WarehouseStockModel.findOne({
    tenantId,
    warehouseId: data.sourceWarehouseId,
    productId: data.productId
  })
    .select('quantity')
    .lean();

  if ((preSource?.quantity ?? 0) < data.quantity) {
    throw new ApiError(400, 'Insufficient stock in source warehouse');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const product = await Product.findOne({ _id: data.productId, tenantId }).session(session);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    if (!product.isActive) {
      throw new ApiError(400, 'Product is inactive');
    }

    // Do not run parallel operations within a transaction session.
    const sourceWarehouse = await WarehouseModel.findOne({
      _id: data.sourceWarehouseId,
      tenantId,
      isActive: true
    }).session(session);
    const destinationWarehouse = await WarehouseModel.findOne({
      _id: data.destinationWarehouseId,
      tenantId,
      isActive: true
    }).session(session);

    if (!sourceWarehouse) {
      throw new ApiError(404, 'Source warehouse not found');
    }
    if (!destinationWarehouse) {
      throw new ApiError(404, 'Destination warehouse not found');
    }

    const sourceStock = await getOrCreateWarehouseStock(session, tenantId, data.sourceWarehouseId, data.productId, product.lowStockThreshold);
    const destinationStock = await getOrCreateWarehouseStock(session, tenantId, data.destinationWarehouseId, data.productId, product.lowStockThreshold);

    if (sourceStock.quantity < data.quantity) {
      throw new ApiError(400, 'Insufficient stock in source warehouse');
    }

    const transferPairId = new mongoose.Types.ObjectId();
    const totalStockBefore = product.totalStock;
    const totalStockAfter = product.totalStock;

    const srcQuantityBefore = sourceStock.quantity;
    const srcQuantityAfter = srcQuantityBefore - data.quantity;
    const dstQuantityBefore = destinationStock.quantity;
    const dstQuantityAfter = dstQuantityBefore + data.quantity;

    const movementOut = (
      await StockMovementModel.create(
        [
          {
            tenantId,
            productId: data.productId,
            warehouseId: data.sourceWarehouseId,
            type: 'TRANSFER_OUT',
            quantity: data.quantity,
            quantityBefore: srcQuantityBefore,
            quantityAfter: srcQuantityAfter,
            totalStockBefore,
            totalStockAfter,
            referenceType: 'TRANSFER',
            referenceId: null,
            note: data.note ?? '',
            performedBy: userId,
            transferPairId
          }
        ],
        { session }
      )
    )[0];

    const movementIn = (
      await StockMovementModel.create(
        [
          {
            tenantId,
            productId: data.productId,
            warehouseId: data.destinationWarehouseId,
            type: 'TRANSFER_IN',
            quantity: data.quantity,
            quantityBefore: dstQuantityBefore,
            quantityAfter: dstQuantityAfter,
            totalStockBefore,
            totalStockAfter,
            referenceType: 'TRANSFER',
            referenceId: null,
            note: data.note ?? '',
            performedBy: userId,
            transferPairId
          }
        ],
        { session }
      )
    )[0];

    await WarehouseStockModel.findOneAndUpdate(
      { tenantId, warehouseId: data.sourceWarehouseId, productId: data.productId },
      { $inc: { quantity: -data.quantity }, $set: { updatedAt: new Date() } },
      { session }
    );

    await WarehouseStockModel.findOneAndUpdate(
      { tenantId, warehouseId: data.destinationWarehouseId, productId: data.productId },
      { $inc: { quantity: data.quantity }, $set: { updatedAt: new Date() } },
      { session }
    );

    await session.commitTransaction();

    await runPostCommitSideEffects([
      enqueueAlertCheck(tenantId, data.productId, data.sourceWarehouseId),
      invalidateWarehouseCache(tenantId),
      triggerStatsRefresh(tenantId),
      invalidateDashboardActivityCache(tenantId),
      Promise.resolve(
        emitStockEvent(tenantId, 'stock:updated', {
          productId: data.productId,
          warehouseId: data.sourceWarehouseId,
          type: 'TRANSFER_OUT',
          quantityAfter: srcQuantityAfter,
          totalStockAfter
        })
      ),
      Promise.resolve(
        emitStockEvent(tenantId, 'stock:updated', {
          productId: data.productId,
          warehouseId: data.destinationWarehouseId,
          type: 'TRANSFER_IN',
          quantityAfter: dstQuantityAfter,
          totalStockAfter
        })
      ),
      Promise.resolve(
        emitStockEvent(tenantId, 'stock:transferred', {
          productId: data.productId,
          sourceWarehouseId: data.sourceWarehouseId,
          destinationWarehouseId: data.destinationWarehouseId,
          quantity: data.quantity
        })
      )
    ]);

    logStockMutationAudit({
      tenantId,
      userId,
      auditCtx,
      product,
      actionType: 'TRANSFER',
      metadata: {
        sourceWarehouseId: data.sourceWarehouseId,
        sourceWarehouseName: sourceWarehouse.name,
        destinationWarehouseId: data.destinationWarehouseId,
        destinationWarehouseName: destinationWarehouse.name,
        quantity: data.quantity,
        sourceQuantityBefore: srcQuantityBefore,
        sourceQuantityAfter: srcQuantityAfter,
        destinationQuantityBefore: dstQuantityBefore,
        destinationQuantityAfter: dstQuantityAfter,
        note: data.note ?? ''
      }
    });

    return { out: movementOut, in: movementIn };
  } catch (error) {
    await safeAbortTransaction(session);
    throw error;
  } finally {
    await session.endSession();
  }
}

interface DecodedCursor {
  createdAt: Date;
  id: mongoose.Types.ObjectId;
}

const decodeCursor = (cursor: string): DecodedCursor => {
  const decoded = Buffer.from(cursor, 'base64').toString('utf8');
  const sepIdx = decoded.indexOf('::');
  if (sepIdx !== -1) {
    const ts = decoded.substring(0, sepIdx);
    const id = decoded.substring(sepIdx + 2);
    return { createdAt: new Date(ts), id: new mongoose.Types.ObjectId(id) };
  }
  // Backwards compat: old cursor is just an ObjectId
  const oid = new mongoose.Types.ObjectId(decoded);
  return { createdAt: oid.getTimestamp(), id: oid };
};

const encodeCursor = (doc: { _id: mongoose.Types.ObjectId; createdAt: Date | string }): string => {
  const ts = typeof doc.createdAt === 'string' ? doc.createdAt : doc.createdAt.toISOString();
  return Buffer.from(`${ts}::${doc._id.toString()}`).toString('base64');
};

export async function listMovements(tenantId: string, query: ListMovementsQuery) {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const filter: Record<string, unknown> = { tenantId };

  if (query.productId) {
    filter.productId = toObjectId(query.productId);
  }
  if (query.warehouseId) {
    filter.warehouseId = toObjectId(query.warehouseId);
  }
  if (query.type) {
    filter.type = query.type;
  }
  if (query.performedBy) {
    filter.performedBy = toObjectId(query.performedBy);
  }
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {
      ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { $lte: new Date(query.dateTo) } : {})
    };
  }
  if (query.cursor) {
    const cur = decodeCursor(query.cursor);
    // Merge date range constraints into the $or cursor branches
    const dateRange = filter.createdAt as Record<string, unknown> | undefined;
    delete filter.createdAt;

    const cursorBranch1: Record<string, unknown> = { createdAt: { $lt: cur.createdAt, ...dateRange } };
    const cursorBranch2: Record<string, unknown> = { createdAt: { $eq: cur.createdAt, ...dateRange }, _id: { $lt: cur.id } };

    filter.$or = [cursorBranch1, cursorBranch2];
  }

  const docs = await StockMovementModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('productId', 'name sku unit')
    .populate('warehouseId', 'name code')
    .populate('performedBy', 'name email')
    .lean();

  const hasMore = docs.length > limit;
  if (hasMore) {
    docs.pop();
  }

  const movements = (docs as Array<Record<string, unknown>>).map((movement: Record<string, unknown>) => ({
    ...movement,
    product: movement.productId && typeof movement.productId === 'object' ? movement.productId : undefined,
    warehouse: movement.warehouseId && typeof movement.warehouseId === 'object' ? movement.warehouseId : undefined,
    performedByUser: movement.performedBy && typeof movement.performedBy === 'object' ? movement.performedBy : undefined,
    productId: (movement.productId as Record<string, unknown>)?._id ?? movement.productId,
    warehouseId: (movement.warehouseId as Record<string, unknown>)?._id ?? movement.warehouseId,
    performedBy: (movement.performedBy as Record<string, unknown>)?._id ?? movement.performedBy
  }));

  const lastDoc = docs[docs.length - 1] as unknown as { _id: mongoose.Types.ObjectId; createdAt: Date };
  const nextCursor = hasMore && docs.length > 0 ? encodeCursor(lastDoc) : null;

  return { movements, nextCursor, hasMore };
}

export async function getMovement(tenantId: string, movementId: string) {
  const movement = await StockMovementModel.findOne({ _id: movementId, tenantId })
    .populate('productId', 'name sku unit')
    .populate('warehouseId', 'name code')
    .populate('performedBy', 'name email')
    .lean();

  if (!movement) {
    throw new ApiError(404, 'Movement not found');
  }

  const response: Record<string, unknown> = {
    ...movement,
    product: movement.productId,
    warehouse: movement.warehouseId,
    performedByUser: movement.performedBy,
    productId: (typeof movement.productId === 'object' && movement.productId !== null && '_id' in movement.productId) ? (movement.productId as unknown as Record<string, unknown>)._id : movement.productId,
    warehouseId: (typeof movement.warehouseId === 'object' && movement.warehouseId !== null && '_id' in movement.warehouseId) ? (movement.warehouseId as unknown as Record<string, unknown>)._id : movement.warehouseId,
    performedBy: (typeof movement.performedBy === 'object' && movement.performedBy !== null && '_id' in movement.performedBy) ? (movement.performedBy as unknown as Record<string, unknown>)._id : movement.performedBy
  };

  if (movement.transferPairId) {
    const pairedMovement = await StockMovementModel.findOne({
      transferPairId: movement.transferPairId,
      _id: { $ne: movement._id },
      tenantId
    })
      .populate('warehouseId', 'name code')
      .lean();

    response.pairedMovement = pairedMovement
      ? {
          ...pairedMovement,
          warehouse: pairedMovement.warehouseId,
          warehouseId: (typeof pairedMovement.warehouseId === 'object' && pairedMovement.warehouseId !== null && '_id' in pairedMovement.warehouseId) ? (pairedMovement.warehouseId as unknown as Record<string, unknown>)._id : pairedMovement.warehouseId
        }
      : null;
  }

  return response;
}

export async function getProductStockByWarehouse(tenantId: string, productId: string) {
  const product = await Product.findOne({ _id: productId, tenantId }).select('_id').lean();
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const warehouseStock = await WarehouseStockModel.find({ tenantId, productId })
    .populate('warehouseId', 'name code isDefault isActive')
    .lean();

  return (warehouseStock as Array<Record<string, unknown>>)
    .map((entry: Record<string, unknown>) => ({
      warehouse: entry.warehouseId as Record<string, unknown> & { isActive?: boolean },
      quantity: entry.quantity,
      reservedQuantity: entry.reservedQuantity
    }))
    .filter((entry) => entry.warehouse?.isActive)
    .sort((a, b) => {
      const aWarehouse = a.warehouse as Record<string, unknown> & { isDefault?: boolean; name?: string };
      const bWarehouse = b.warehouse as Record<string, unknown> & { isDefault?: boolean; name?: string };
      if (aWarehouse.isDefault && !bWarehouse.isDefault) return -1;
      if (!aWarehouse.isDefault && bWarehouse.isDefault) return 1;
      return (aWarehouse.name ?? '').localeCompare(bWarehouse.name ?? '');
    });
}

export async function listAlerts(tenantId: string, query: ListAlertsQuery) {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const filter: Record<string, unknown> = { tenantId };

  if (query.status) {
    filter.status = query.status;
  }
  if (query.productId) {
    filter.productId = toObjectId(query.productId);
  }
  if (query.cursor) {
    const cur = decodeCursor(query.cursor);
    filter.$or = [
      { createdAt: { $lt: cur.createdAt } },
      { createdAt: cur.createdAt, _id: { $lt: cur.id } }
    ];
  }

  const docs = await StockAlertModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('productId', 'name sku unit')
    .populate('warehouseId', 'name code')
    .lean();

  const hasMore = docs.length > limit;
  if (hasMore) {
    docs.pop();
  }

  const alerts = docs.map((alert: Record<string, unknown>) => ({
    ...alert,
    product: alert.productId,
    warehouse: alert.warehouseId,
    productId: (alert.productId as Record<string, unknown>)?._id ?? alert.productId,
    warehouseId: (alert.warehouseId as Record<string, unknown>)?._id ?? alert.warehouseId
  }));

  const lastDoc = docs[docs.length - 1] as unknown as { _id: mongoose.Types.ObjectId; createdAt: Date };
  const nextCursor = hasMore && docs.length > 0 ? encodeCursor(lastDoc) : null;

  return { alerts, nextCursor, hasMore };
}

export async function getPendingAlertCount(tenantId: string): Promise<number> {
  const cacheKey = CACHE_KEYS.pendingAlertCount(tenantId);
  const cached = await getCache<number>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const count = await StockAlertModel.countDocuments({ tenantId, status: 'PENDING' });
  await setCache(cacheKey, count, 30);
  return count;
}

export async function acknowledgeAlert(
  tenantId: string,
  alertId: string,
  userId: string,
  auditCtx: AuditContext
): Promise<IStockAlert> {
  const alert = await StockAlertModel.findOne({ _id: alertId, tenantId });
  if (!alert) {
    throw new ApiError(404, 'Alert not found');
  }
  if (alert.status === 'ACKNOWLEDGED') {
    throw new ApiError(400, 'Alert already acknowledged');
  }

  alert.status = 'ACKNOWLEDGED';
  alert.acknowledgedBy = toObjectId(userId);
  alert.acknowledgedAt = new Date();
  await alert.save();

  const product = await Product.findById(alert.productId).select('name sku').lean();
  const warehouse = await WarehouseModel.findById(alert.warehouseId).select('name').lean();

  createAuditLog({
    tenantId,
    performedBy: userId,
    performedByName: auditCtx.performedByName,
    performedByEmail: auditCtx.performedByEmail,
    action: 'stock.adjusted',
    entityType: 'stock',
    entityId: alert.productId.toString(),
    entityName: product ? `${product.name} (${product.sku})` : 'Stock alert',
    metadata: {
      movementType: 'ALERT_ACKNOWLEDGED',
      alertId: alert._id.toString(),
      warehouseId: alert.warehouseId.toString(),
      warehouseName: warehouse?.name ?? null
    },
    ipAddress: auditCtx.ipAddress,
    userAgent: auditCtx.userAgent
  }).catch(() => {});

  await deleteCache(CACHE_KEYS.pendingAlertCount(tenantId));
  return alert;
}

export async function bulkAcknowledge(
  tenantId: string,
  alertIds: string[],
  userId: string,
  auditCtx: AuditContext
): Promise<{ acknowledged: number }> {
  const objectIds = alertIds.map((id) => toObjectId(id));
  const totalForTenant = await StockAlertModel.countDocuments({ tenantId, _id: { $in: objectIds } });

  if (totalForTenant !== objectIds.length) {
    throw new ApiError(400, 'One or more alerts do not belong to this tenant');
  }

  const result = await StockAlertModel.updateMany(
    { tenantId, _id: { $in: objectIds }, status: 'PENDING' },
    {
      $set: {
        status: 'ACKNOWLEDGED',
        acknowledgedBy: toObjectId(userId),
        acknowledgedAt: new Date()
      }
    }
  );

  if ((result.modifiedCount ?? 0) > 0) {
    createAuditLog({
      tenantId,
      performedBy: userId,
      performedByName: auditCtx.performedByName,
      performedByEmail: auditCtx.performedByEmail,
      action: 'stock.adjusted',
      entityType: 'stock',
      entityName: 'Bulk alert acknowledge',
      metadata: {
        movementType: 'ALERT_BULK_ACKNOWLEDGED',
        acknowledgedCount: result.modifiedCount ?? 0,
        alertIds
      },
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent
    }).catch(() => {});
  }

  await deleteCache(CACHE_KEYS.pendingAlertCount(tenantId));
  return { acknowledged: result.modifiedCount ?? 0 };
}
