import mongoose from 'mongoose';
import { Worker } from 'bullmq';
import { config } from '../../config';
import { redis } from '../../config/redis';
import { getIO } from '../../config/socket';
import { Product } from '../../models/Product';
import { StockAlertModel } from '../../models/StockAlert';
import { StockMovementModel } from '../../models/StockMovement';
import { WarehouseModel } from '../../models/Warehouse';
import { WarehouseStockModel } from '../../models/WarehouseStock';
import { logger } from '../../utils/logger';

export interface DashboardOverview {
  totalProducts: number;
  totalUnits: number;
  totalStockValue: number;
  lowStockProducts: number;
  pendingAlerts: number;
  activeWarehouses: number;
  totalWarehouses: number;
}

export interface MovementChartData {
  date: string;
  in: number;
  out: number;
}

export interface CategoryChartData {
  name: string;
  color: string;
  value: number;
  units: number;
}

export interface WarehouseChartData {
  name: string;
  code: string;
  totalUnits: number;
}

export interface DashboardStats {
  overview: DashboardOverview;
  charts: {
    movements: MovementChartData[];
    categories: CategoryChartData[];
    warehouses: WarehouseChartData[];
  };
  computedAt: string;
}

interface DashboardStatsPayload {
  tenantId: string;
}

const roundTo2 = (value: number): number => Math.round(value * 100) / 100;

export async function computeAndCacheDashboardStats(tenantId: string): Promise<DashboardStats> {
  const objectId = new mongoose.Types.ObjectId(tenantId);

  const [
    productStats,
    stockValueResult,
    lowStockCount,
    pendingAlertCount,
    warehouseStats,
    movementChart,
    categoryChart,
    warehouseChart
  ] = await Promise.all([
    Product.aggregate([
      { $match: { tenantId: objectId, isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalUnits: { $sum: '$totalStock' }
        }
      }
    ]),
    Product.aggregate([
      { $match: { tenantId: objectId, isActive: true, totalStock: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$totalStock', '$costPrice'] } }
        }
      }
    ]),
    Product.countDocuments({
      tenantId: objectId,
      isActive: true,
      $expr: { $lte: ['$totalStock', '$lowStockThreshold'] }
    }),
    StockAlertModel.countDocuments({ tenantId: objectId, status: 'PENDING' }),
    WarehouseModel.aggregate([
      { $match: { tenantId: objectId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]),
    StockMovementModel.aggregate([
      {
        $match: {
          tenantId: objectId,
          type: { $in: ['IN', 'OUT'] },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type'
          },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]),
    Product.aggregate([
      { $match: { tenantId: objectId, isActive: true, totalStock: { $gt: 0 } } },
      {
        $group: {
          _id: '$categoryId',
          value: { $sum: { $multiply: ['$totalStock', '$costPrice'] } },
          units: { $sum: '$totalStock' }
        }
      },
      { $sort: { value: -1 } },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ]),
    WarehouseStockModel.aggregate([
      { $match: { tenantId: objectId } },
      {
        $group: {
          _id: '$warehouseId',
          totalUnits: { $sum: '$quantity' }
        }
      },
      {
        $lookup: {
          from: 'warehouses',
          localField: '_id',
          foreignField: '_id',
          as: 'warehouse'
        }
      },
      { $unwind: '$warehouse' },
      { $match: { 'warehouse.isActive': true } },
      { $sort: { totalUnits: -1 } }
    ])
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(thirtyDaysAgo);
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  });

  const movementMap: Record<string, { in: number; out: number }> = {};
  for (const day of days) {
    movementMap[day] = { in: 0, out: 0 };
  }

  for (const item of movementChart as Array<{ _id: { date: string; type: 'IN' | 'OUT' }; totalQuantity: number }>) {
    if (movementMap[item._id.date]) {
      movementMap[item._id.date][item._id.type.toLowerCase() as 'in' | 'out'] = item.totalQuantity;
    }
  }

  const movementChartData: MovementChartData[] = days.map((date) => ({
    date,
    ...movementMap[date]
  }));

  const categoryRows = categoryChart as Array<{
    value: number;
    units: number;
    category?: { name?: string; color?: string };
  }>;

  const top6 = categoryRows.slice(0, 6);
  const otherValue = categoryRows.slice(6).reduce((sum, item) => sum + item.value, 0);

  const categoryChartData: CategoryChartData[] = [
    ...top6.map((item) => ({
      name: item.category?.name ?? 'Uncategorized',
      color: item.category?.color ?? '#888780',
      value: roundTo2(item.value),
      units: item.units
    })),
    ...(otherValue > 0
      ? [{ name: 'Other', color: '#B4B2A9', value: roundTo2(otherValue), units: 0 }]
      : [])
  ];

  const stats: DashboardStats = {
    overview: {
      totalProducts: (productStats as Array<{ totalProducts: number }>)[0]?.totalProducts ?? 0,
      totalUnits: (productStats as Array<{ totalUnits: number }>)[0]?.totalUnits ?? 0,
      totalStockValue: roundTo2((stockValueResult as Array<{ totalValue: number }>)[0]?.totalValue ?? 0),
      lowStockProducts: lowStockCount,
      pendingAlerts: pendingAlertCount,
      activeWarehouses: (warehouseStats as Array<{ active: number }>)[0]?.active ?? 0,
      totalWarehouses: (warehouseStats as Array<{ total: number }>)[0]?.total ?? 0
    },
    charts: {
      movements: movementChartData,
      categories: categoryChartData,
      warehouses: (warehouseChart as Array<{ warehouse: { name: string; code: string }; totalUnits: number }>).map(
        (item) => ({
          name: item.warehouse.name,
          code: item.warehouse.code,
          totalUnits: item.totalUnits
        })
      )
    },
    computedAt: new Date().toISOString()
  };

  const cacheKey = `dashboard:stats:${tenantId}`;
  await redis.set(cacheKey, JSON.stringify(stats), 'EX', 600);

  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('dashboard:refreshed', { computedAt: stats.computedAt });
  } catch {
    // best effort side effect
  }

  return stats;
}

export function startDashboardStatsWorker(): Worker {
  const worker = new Worker(
    'dashboard-stats',
    async (job) => {
      const { tenantId } = job.data as DashboardStatsPayload;
      await computeAndCacheDashboardStats(tenantId);
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: 3,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 5 }
    }
  );

  worker.on('error', (error) => {
    logger.error('dashboard_stats_worker_error', { error });
  });

  logger.info('dashboard_stats_worker_started');
  return worker;
}
