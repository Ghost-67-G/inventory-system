import { Worker } from 'bullmq';
import { config } from '../../config';
import { getIO } from '../../config/socket';
import { StockAlertModel } from '../../models/StockAlert';
import { Product } from '../../models/Product';
import { WarehouseStockModel } from '../../models/WarehouseStock';
import { deleteCache, CACHE_KEYS } from '../../config/redis';
import { logger } from '../../utils/logger';

interface AlertCheckPayload {
  tenantId: string;
  productId: string;
  warehouseId: string;
}

const emitAlertEvent = (
  tenantId: string,
  payload: {
    productId: string;
    warehouseId: string;
    productName: string;
    currentStock: number;
    threshold: number;
  }
): void => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('alert:new', payload);
  } catch {
    // best effort side effect
  }
};

export function startAlertCheckWorker(): Worker {
  const worker = new Worker(
    'alert-check',
    async (job) => {
      const { tenantId, productId, warehouseId } = job.data as AlertCheckPayload;

      const product = await Product.findOne({ _id: productId, tenantId })
        .select('name lowStockThreshold')
        .lean();
      if (!product) {
        return;
      }

      const warehouseStock = await WarehouseStockModel.findOne({ tenantId, productId, warehouseId })
        .select('quantity')
        .lean();
      if (!warehouseStock) {
        return;
      }

      const currentStock = warehouseStock.quantity;
      const threshold = product.lowStockThreshold ?? 0;

      if (currentStock <= threshold) {
        const existing = await StockAlertModel.findOne({ tenantId, productId, warehouseId, status: 'PENDING' });

        if (!existing) {
          await StockAlertModel.create({
            tenantId,
            productId,
            warehouseId,
            currentStock,
            threshold,
            status: 'PENDING'
          });

          await deleteCache(CACHE_KEYS.pendingAlertCount(tenantId));

          emitAlertEvent(tenantId, {
            productId,
            warehouseId,
            productName: product.name,
            currentStock,
            threshold
          });
        } else {
          existing.currentStock = currentStock;
          existing.threshold = threshold;
          await existing.save();
        }

        return;
      }

      const result = await StockAlertModel.updateMany(
        { tenantId, productId, warehouseId, status: 'PENDING' },
        { $set: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() } }
      );

      if (result.modifiedCount > 0) {
        await deleteCache(CACHE_KEYS.pendingAlertCount(tenantId));
      }
    },
    {
      connection: { url: config.REDIS_URL },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      concurrency: 10
    }
  );

  worker.on('error', (error) => {
    logger.error('alert_check_worker_error', { error });
  });

  logger.info('alert_check_worker_started');
  return worker;
}
