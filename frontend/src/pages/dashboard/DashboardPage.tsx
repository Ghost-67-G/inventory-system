import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  Boxes,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  TrendingUp,
  Warehouse
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import { RecordMovementDrawer } from '@/components/stock/RecordMovementDrawer';
import { ActivityFeedItem } from '@/components/dashboard/ActivityFeedItem';
import { CategoryDonutChart } from '@/components/dashboard/CategoryDonutChart';
import { MovementBarChart } from '@/components/dashboard/MovementBarChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { WarehouseBarChart } from '@/components/dashboard/WarehouseBarChart';
import { useDashboardActivity, useDashboardStats } from '@/hooks/useDashboard';
import { useTenantStore } from '@/store/tenantStore';

type DrawerType = 'in' | 'out' | 'transfer';

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(value);
}

function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <Skeleton className="mb-3 h-4 w-2/3" />
          <Skeleton className="mb-2 h-8 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const tenantCurrency = useTenantStore((state) => state.tenant?.settings.currency ?? 'USD');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<DrawerType>('in');

  const statsQuery = useDashboardStats();
  const activityQuery = useDashboardActivity();

  const stats = statsQuery.data;

  const isStatsStale = useMemo(() => {
    if (!stats?.computedAt) {
      return false;
    }
    const computedAt = new Date(stats.computedAt).getTime();
    if (!Number.isFinite(computedAt)) {
      return false;
    }
    return Date.now() - computedAt > 10 * 60 * 1000;
  }, [stats?.computedAt]);

  const openDrawer = (type: DrawerType) => {
    setDrawerType(type);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational and financial inventory snapshot</p>
      </div>

      {statsQuery.isLoading ? (
        <DashboardStatsSkeleton />
      ) : statsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <p>Could not load stats.</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void statsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          <StatCard
            label="Total products"
            value={(stats?.overview.totalProducts ?? 0).toLocaleString()}
            icon={Package}
            accentColor="blue"
            helperText="Active products"
          />

          <StatCard
            label="Stock value"
            value={formatMoney(stats?.overview.totalStockValue ?? 0, tenantCurrency)}
            icon={TrendingUp}
            accentColor="green"
            helperText="at cost price"
          />

          <StatCard
            label="Low stock"
            value={stats?.overview.lowStockProducts ?? 0}
            icon={AlertTriangle}
            accentColor={(stats?.overview.lowStockProducts ?? 0) > 0 ? 'amber' : 'green'}
            helperText="Low stock items"
            onClick={() => navigate('/products?lowStock=true')}
          />

          <StatCard
            label="Pending alerts"
            value={stats?.overview.pendingAlerts ?? 0}
            icon={Bell}
            accentColor={(stats?.overview.pendingAlerts ?? 0) > 0 ? 'red' : 'green'}
            helperText="Pending alerts"
            onClick={() => navigate('/alerts')}
          />

          <StatCard
            label="Warehouses"
            value={`${stats?.overview.activeWarehouses ?? 0}/${stats?.overview.totalWarehouses ?? 0}`}
            icon={Warehouse}
            accentColor="teal"
            helperText="Active warehouses"
          />

          <StatCard
            label="Total units"
            value={(stats?.overview.totalUnits ?? 0).toLocaleString()}
            icon={Boxes}
            accentColor="purple"
            helperText="Units in stock"
          />

          <StatCard
            label="Pending orders"
            value={stats?.overview.pendingPOs ?? 0}
            icon={ShoppingCart}
            accentColor={(stats?.overview.pendingPOs ?? 0) > 0 ? 'amber' : 'green'}
            helperText="Pending POs"
            onClick={() => navigate('/purchase-orders?status=OPEN')}
          />
        </div>
      )}

      {isStatsStale ? (
        <div className="rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-300">
          Stats may be slightly outdated - refresh in progress.
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-3">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-foreground">Stock movements</h2>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <MovementBarChart data={stats?.charts.movements ?? []} isLoading={statsQuery.isLoading} />
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-foreground">Value by category</h2>
          </div>
          <CategoryDonutChart
            data={stats?.charts.categories ?? []}
            currency={tenantCurrency}
            isLoading={statsQuery.isLoading}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-foreground">Warehouse utilization</h2>
        <WarehouseBarChart data={stats?.charts.warehouses ?? []} isLoading={statsQuery.isLoading} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-2 lg:order-last">
          <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
          <div className="mt-3 divide-y divide-border rounded-lg border border-border">
            <PermissionGuard permission="stock.adjust">
              <button
                type="button"
                className="flex min-h-13 w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50"
                onClick={() => openDrawer('in')}
              >
                <Plus className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Add stock</p>
                  <p className="text-xs text-muted-foreground">Record stock in from a purchase or return</p>
                </div>
              </button>
            </PermissionGuard>

            <PermissionGuard permission="stock.adjust">
              <button
                type="button"
                className="flex min-h-13 w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50"
                onClick={() => openDrawer('out')}
              >
                <Minus className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Remove stock</p>
                  <p className="text-xs text-muted-foreground">Record stock out for a sale or usage</p>
                </div>
              </button>
            </PermissionGuard>

            <PermissionGuard permission="stock.adjust">
              <button
                type="button"
                className="flex min-h-13 w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50"
                onClick={() => openDrawer('transfer')}
              >
                <ArrowLeftRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Transfer stock</p>
                  <p className="text-xs text-muted-foreground">Move stock between warehouses</p>
                </div>
              </button>
            </PermissionGuard>

            {(stats?.overview.pendingAlerts ?? 0) > 0 ? (
              <PermissionGuard permission="alert.view">
                <button
                  type="button"
                  className="flex min-h-13 w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => navigate('/alerts')}
                >
                  <Bell className="mt-0.5 h-4 w-4 text-red-600 dark:text-red-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">View alerts</p>
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {stats?.overview.pendingAlerts}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{stats?.overview.pendingAlerts} items need attention</p>
                  </div>
                </button>
              </PermissionGuard>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Last updated{' '}
            {stats?.computedAt ? formatDistanceToNow(new Date(stats.computedAt), { addSuffix: true }) : 'just now'}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-3 lg:order-first">
          <div className="mb-2">
            <h2 className="text-base font-semibold text-foreground">Recent activity</h2>
            <p className="text-xs text-muted-foreground">Last 10 movements</p>
          </div>

          <div>
            {activityQuery.isLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : activityQuery.isError ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>Could not load recent activity.</p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => void activityQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : activityQuery.data && activityQuery.data.length > 0 ? (
              <>
                {activityQuery.data.map((movement, index) => (
                  <div key={movement._id ?? index} className={index !== activityQuery.data.length - 1 ? 'border-b border-border' : ''}>
                    <ActivityFeedItem movement={movement} />
                  </div>
                ))}
                <Link to="/stock" className="mt-2 inline-block text-sm font-medium text-muted-foreground hover:text-foreground">
                  View all movements -&gt;
                </Link>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No recent activity.</p>
            )}
          </div>
        </div>
      </section>

      <RecordMovementDrawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} type={drawerType} />
    </div>
  );
}
