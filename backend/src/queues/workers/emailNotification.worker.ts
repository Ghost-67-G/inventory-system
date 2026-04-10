import { DateTime } from 'luxon';
import mongoose from 'mongoose';
import { Worker } from 'bullmq';
import { config } from '../../config';
import { redis } from '../../config/redis';
import { ImportJob } from '../../models/ImportJob';
import { Product } from '../../models/Product';
import { PurchaseOrderModel } from '../../models/PurchaseOrder';
import { StockAlertModel } from '../../models/StockAlert';
import { StockMovementModel } from '../../models/StockMovement';
import { TenantModel } from '../../models/Tenant';
import { UserModel } from '../../models/User';
import {
  sendDailySummaryEmail,
  sendImportCompletionEmail,
  sendLowStockAlertEmail,
  sendPurchaseOrderEmail
} from '../../utils/email';
import { logger } from '../../utils/logger';
import { enqueueDailySummaryEmail } from '../jobs/emailNotification.job';

type LowStockAlertJobData = { tenantId: string; alertId: string };
type DailySummaryJobData = { tenantId: string };
type ImportCompletionJobData = { tenantId: string; importJobId: string; userId: string };
type POSentJobData = { tenantId: string; poId: string };

function formatDisplayDate(isoDate: string): string {
  const date = DateTime.fromISO(isoDate);
  if (!date.isValid) {
    return DateTime.now().toFormat('EEEE, LLLL d, yyyy');
  }

  return date.toFormat('EEEE, LLLL d, yyyy');
}

async function handleLowStockAlert(data: LowStockAlertJobData): Promise<void> {
  const tenant = await TenantModel.findById(data.tenantId)
    .select('settings.currency settings.emailNotifications')
    .lean();

  if (!tenant?.settings?.emailNotifications?.lowStockAlerts) {
    return;
  }

  const alert = await StockAlertModel.findOne({ _id: data.alertId, tenantId: data.tenantId, status: 'PENDING' })
    .populate('productId', 'name sku unit')
    .populate('warehouseId', 'name')
    .lean();

  if (!alert) {
    return;
  }

  const productId = String(alert.productId?._id ?? '');
  if (!productId) {
    return;
  }

  const cooldownKey = `email:low-stock:cooldown:${data.tenantId}:${productId}`;
  const isCooldownActive = await redis.get(cooldownKey);
  if (isCooldownActive) {
    return;
  }

  const owners = await UserModel.find({ tenantId: data.tenantId, role: 'owner', isActive: true })
    .select('name email')
    .lean();

  if (owners.length === 0) {
    return;
  }

  const productName = String((alert.productId as { name?: string }).name ?? 'Unknown product');
  const sku = String((alert.productId as { sku?: string }).sku ?? 'N/A');
  const unit = String((alert.productId as { unit?: string }).unit ?? 'units');
  const warehouseName = String((alert.warehouseId as { name?: string }).name ?? 'Unknown warehouse');
  const currency = tenant.settings.currency ?? 'USD';

  const sendResults = await Promise.allSettled(
    owners.map((owner) =>
      sendLowStockAlertEmail(owner.email, {
        ownerName: owner.name,
        productName,
        sku,
        currentStock: alert.currentStock,
        threshold: alert.threshold,
        unit,
        warehouseName,
        currency,
        appUrl: config.FRONTEND_URL
      })
    )
  );

  const successCount = sendResults.filter((result) => result.status === 'fulfilled').length;
  if (successCount > 0) {
    await redis.set(cooldownKey, '1', 'EX', 4 * 60 * 60);
  }
}

async function handleDailySummary(data: DailySummaryJobData): Promise<void> {
  const tenant = await TenantModel.findById(data.tenantId)
    .select('settings.currency settings.timezone settings.emailNotifications')
    .lean();

  if (!tenant?.settings?.emailNotifications?.dailySummary) {
    return;
  }

  const timezone = tenant.settings.timezone || 'UTC';
  const localNow = DateTime.now().setZone(timezone);
  const localStart = localNow.startOf('day');
  const utcStart = localStart.toUTC().toJSDate();

  const tenantObjectId = new mongoose.Types.ObjectId(data.tenantId);

  const [pendingAlerts, movementsToday, lowStockProducts, totalStockValueData] = await Promise.all([
    StockAlertModel.countDocuments({ tenantId: data.tenantId, status: 'PENDING' }),
    StockMovementModel.countDocuments({ tenantId: data.tenantId, createdAt: { $gte: utcStart } }),
    Product.find({
      tenantId: data.tenantId,
      isActive: true,
      $expr: { $lte: ['$totalStock', '$lowStockThreshold'] }
    })
      .select('name sku totalStock unit lowStockThreshold')
      .sort({ totalStock: 1 })
      .limit(10)
      .lean(),
    Product.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$totalStock', '$costPrice'] } }
        }
      }
    ])
  ]);

  const totalStockValue = Number(totalStockValueData[0]?.total ?? 0);

  if (pendingAlerts === 0 && movementsToday === 0) {
    return;
  }

  const owners = await UserModel.find({ tenantId: data.tenantId, role: 'owner', isActive: true })
    .select('name email')
    .lean();

  if (owners.length === 0) {
    return;
  }

  const date = formatDisplayDate(localNow.toISODate() ?? localNow.toFormat('yyyy-LL-dd'));

  await Promise.allSettled(
    owners.map((owner) =>
      sendDailySummaryEmail(owner.email, {
        ownerName: owner.name,
        date,
        pendingAlerts,
        movementsToday,
        totalStockValue,
        currency: tenant.settings.currency ?? 'USD',
        topLowStock: lowStockProducts.map((item) => ({
          name: item.name,
          sku: item.sku,
          totalStock: item.totalStock,
          unit: item.unit,
          threshold: item.lowStockThreshold
        })),
        appUrl: config.FRONTEND_URL
      })
    )
  );
}

async function handleImportCompletion(data: ImportCompletionJobData): Promise<void> {
  const tenant = await TenantModel.findById(data.tenantId).select('settings.emailNotifications').lean();
  if (!tenant?.settings?.emailNotifications?.importCompletion) {
    return;
  }

  const importJob = await ImportJob.findOne({ _id: data.importJobId, tenantId: data.tenantId }).lean();
  if (!importJob) {
    return;
  }

  if (importJob.status !== 'COMPLETED' && importJob.status !== 'PARTIAL' && importJob.status !== 'FAILED') {
    return;
  }

  const user = await UserModel.findOne({ _id: data.userId, tenantId: data.tenantId, isActive: true })
    .select('name email')
    .lean();
  if (!user) {
    return;
  }

  await sendImportCompletionEmail(user.email, {
    userName: user.name,
    fileName: importJob.fileName,
    status: importJob.status,
    successCount: importJob.successCount,
    errorCount: importJob.errorCount,
    totalRows: importJob.totalRows,
    appUrl: config.FRONTEND_URL
  });
}

async function handlePOSent(data: POSentJobData): Promise<void> {
  const [tenant, order, owners] = await Promise.all([
    TenantModel.findById(data.tenantId).select('name').lean(),
    PurchaseOrderModel.findOne({ _id: data.poId, tenantId: data.tenantId })
      .populate('supplierId', 'name email')
      .lean(),
    UserModel.find({ tenantId: data.tenantId, role: 'owner', isActive: true }).select('email').lean()
  ]);

  if (!tenant || !order) {
    return;
  }

  const supplier = order.supplierId as unknown as { name?: string; email?: string };
  const supplierEmail = supplier?.email;
  const ownerEmail = owners[0]?.email;

  if (!supplierEmail || !ownerEmail) {
    return;
  }

  await sendPurchaseOrderEmail(supplierEmail, ownerEmail, {
    tenantName: tenant.name,
    poNumber: order.poNumber,
    supplierName: order.supplierName,
    orderDate: DateTime.fromJSDate(order.orderDate).toFormat('yyyy-LL-dd'),
    expectedDeliveryDate: order.expectedDeliveryDate
      ? DateTime.fromJSDate(order.expectedDeliveryDate).toFormat('yyyy-LL-dd')
      : null,
    currency: order.currency,
    subtotal: order.subtotal,
    taxRate: order.taxRate,
    taxAmount: order.taxAmount,
    shippingCost: order.shippingCost,
    totalAmount: order.totalAmount,
    notes: order.notes,
    lineItems: order.lineItems.map((lineItem) => ({
      productName: lineItem.productName,
      productSku: lineItem.productSku,
      orderedQty: lineItem.orderedQty,
      unitCost: lineItem.unitCost,
      totalCost: lineItem.totalCost
    }))
  });
}

export function startEmailNotificationWorker(): Worker {
  const worker = new Worker(
    'email-notifications',
    async (job) => {
      if (job.name === 'low-stock-alert') {
        await handleLowStockAlert(job.data as LowStockAlertJobData);
        return;
      }

      if (job.name === 'daily-summary') {
        await handleDailySummary(job.data as DailySummaryJobData);
        return;
      }

      if (job.name === 'import-completion') {
        await handleImportCompletion(job.data as ImportCompletionJobData);
        return;
      }

      if (job.name === 'po-sent') {
        await handlePOSent(job.data as POSentJobData);
      }
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: 5,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 }
    }
  );

  worker.on('error', (error) => {
    logger.error('email_notification_worker_error', { error });
  });

  logger.info('email_notification_worker_started');
  return worker;
}

export function startEmailSchedulerWorker(): Worker {
  const worker = new Worker(
    'email-scheduler',
    async (job) => {
      if (job.name !== 'check-daily-summaries') {
        return;
      }

      const tenants = await TenantModel.find({ isActive: true })
        .select('_id settings.timezone settings.emailNotifications')
        .lean();

      for (const tenant of tenants) {
        if (!tenant.settings?.emailNotifications?.dailySummary) {
          continue;
        }

        const timezone = tenant.settings.timezone || 'UTC';
        const localNow = DateTime.now().setZone(timezone);
        if (localNow.hour !== 8 || localNow.minute >= 15) {
          continue;
        }

        const dateInTenantTz = localNow.toISODate();
        if (!dateInTenantTz) {
          continue;
        }

        const tenantId = String(tenant._id);
        const dedupeKey = `email:daily-sent:${tenantId}:${dateInTenantTz}`;
        const alreadyQueued = await redis.get(dedupeKey);

        if (alreadyQueued) {
          continue;
        }

        await redis.set(dedupeKey, '1', 'EX', 24 * 60 * 60);
        await enqueueDailySummaryEmail(tenantId);
      }
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: 1,
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 10 }
    }
  );

  worker.on('error', (error) => {
    logger.error('email_scheduler_worker_error', { error });
  });

  logger.info('email_scheduler_worker_started');
  return worker;
}