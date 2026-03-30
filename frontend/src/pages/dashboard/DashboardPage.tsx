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
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Operational and financial inventory snapshot</p>
      </div>

      {statsQuery.isLoading ? (
        <DashboardStatsSkeleton />
      ) : statsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>Could not load stats.</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void statsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatCard
            label="Total products"
            value={stats?.overview.totalProducts.toLocaleString() ?? 0}
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
            value={stats?.overview.totalUnits.toLocaleString() ?? 0}
            icon={Boxes}
            accentColor="purple"
            helperText="Units in stock"
          />
        </div>
      )}

      {isStatsStale ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Stats may be slightly outdated - refresh in progress.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-slate-900">Stock movements</h2>
            <p className="text-xs text-slate-500">Last 30 days</p>
          </div>
          <MovementBarChart data={stats?.charts.movements ?? []} isLoading={statsQuery.isLoading} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-slate-900">Value by category</h2>
          </div>
          <CategoryDonutChart
            data={stats?.charts.categories ?? []}
            currency={tenantCurrency}
            isLoading={statsQuery.isLoading}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Warehouse utilization</h2>
        <WarehouseBarChart data={stats?.charts.warehouses ?? []} isLoading={statsQuery.isLoading} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-2">
            <h2 className="text-base font-semibold text-slate-900">Recent activity</h2>
            <p className="text-xs text-slate-500">Last 10 movements</p>
          </div>

          <div>
            {activityQuery.isLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : activityQuery.data && activityQuery.data.length > 0 ? (
              <>
                {activityQuery.data.map((movement, index) => (
                  <div key={movement._id} className={index !== activityQuery.data.length - 1 ? 'border-b border-slate-100' : ''}>
                    <ActivityFeedItem movement={movement} />
                  </div>
                ))}
                <Link to="/stock" className="mt-2 inline-block text-sm font-medium text-slate-700 hover:text-slate-900">
                  View all movements -&gt;
                </Link>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">No recent activity.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            <PermissionGuard permission="stock.adjust">
              <button
                type="button"
                className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-slate-50"
                onClick={() => openDrawer('in')}
              >
                <Plus className="mt-0.5 h-4 w-4 text-slate-700" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Add stock</p>
                  <p className="text-xs text-slate-500">Record stock in from a purchase or return</p>
                </div>
              </button>
            </PermissionGuard>

            <PermissionGuard permission="stock.adjust">
              <button
                type="button"
                className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-slate-50"
                onClick={() => openDrawer('out')}
              >
                <Minus className="mt-0.5 h-4 w-4 text-slate-700" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Remove stock</p>
                  <p className="text-xs text-slate-500">Record stock out for a sale or usage</p>
                </div>
              </button>
            </PermissionGuard>

            <PermissionGuard permission="stock.adjust">
              <button
                type="button"
                className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-slate-50"
                onClick={() => openDrawer('transfer')}
              >
                <ArrowLeftRight className="mt-0.5 h-4 w-4 text-slate-700" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Transfer stock</p>
                  <p className="text-xs text-slate-500">Move stock between warehouses</p>
                </div>
              </button>
            </PermissionGuard>

            {(stats?.overview.pendingAlerts ?? 0) > 0 ? (
              <PermissionGuard permission="alert.view">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-slate-50"
                  onClick={() => navigate('/alerts')}
                >
                  <Bell className="mt-0.5 h-4 w-4 text-red-700" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">View alerts</p>
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {stats?.overview.pendingAlerts}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{stats?.overview.pendingAlerts} items need attention</p>
                  </div>
                </button>
              </PermissionGuard>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Last updated{' '}
            {stats?.computedAt ? formatDistanceToNow(new Date(stats.computedAt), { addSuffix: true }) : 'just now'}
          </p>
        </div>
      </section>

      <RecordMovementDrawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} type={drawerType} />
    </div>
  );
}
