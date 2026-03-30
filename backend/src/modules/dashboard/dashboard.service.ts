import { redis } from '../../config/redis';
import { StockMovementModel, type IStockMovement } from '../../models/StockMovement';
import { enqueueDashboardStatsRefresh } from '../../queues/jobs/dashboardStats.job';
import { type DashboardStats, computeAndCacheDashboardStats } from '../../queues/workers/dashboardStats.worker';

const DASHBOARD_STATS_CACHE_PREFIX = 'dashboard:stats:';
const DASHBOARD_ACTIVITY_CACHE_PREFIX = 'dashboard:activity:';
const STATS_STALE_AFTER_MS = 5 * 60 * 1000;

export async function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  const cacheKey = `${DASHBOARD_STATS_CACHE_PREFIX}${tenantId}`;
  const cached = await redis.get(cacheKey);

  if (!cached) {
    return computeAndCacheDashboardStats(tenantId);
  }

  try {
    const parsed = JSON.parse(cached) as DashboardStats;
    const computedAtTime = new Date(parsed.computedAt).getTime();

    if (Number.isFinite(computedAtTime) && Date.now() - computedAtTime > STATS_STALE_AFTER_MS) {
      void enqueueDashboardStatsRefresh(tenantId).catch(() => {
        // best effort refresh
      });
    }

    return parsed;
  } catch {
    return computeAndCacheDashboardStats(tenantId);
  }
}

export async function getRecentActivity(tenantId: string): Promise<IStockMovement[]> {
  const cacheKey = `${DASHBOARD_ACTIVITY_CACHE_PREFIX}${tenantId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached) as IStockMovement[];
    } catch {
      // Fall through to DB query if cache payload is malformed.
    }
  }

  const movements = await StockMovementModel.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('productId', 'name sku unit')
    .populate('warehouseId', 'name code')
    .populate('performedBy', 'name')
    .lean();

  const normalized = movements.map((movement: any) => ({
    ...movement,
    product: movement.productId && typeof movement.productId === 'object' ? movement.productId : undefined,
    warehouse: movement.warehouseId && typeof movement.warehouseId === 'object' ? movement.warehouseId : undefined,
    performedByUser: movement.performedBy && typeof movement.performedBy === 'object' ? movement.performedBy : undefined,
    productId: movement.productId?._id ?? movement.productId,
    warehouseId: movement.warehouseId?._id ?? movement.warehouseId,
    performedBy: movement.performedBy?._id ?? movement.performedBy
  }));

  await redis.set(cacheKey, JSON.stringify(normalized), 'EX', 30);

  return normalized as unknown as IStockMovement[];
}

export async function triggerStatsRefresh(tenantId: string): Promise<void> {
  await enqueueDashboardStatsRefresh(tenantId);
}

export async function invalidateDashboardActivityCache(tenantId: string): Promise<void> {
  await redis.del(`${DASHBOARD_ACTIVITY_CACHE_PREFIX}${tenantId}`);
}
