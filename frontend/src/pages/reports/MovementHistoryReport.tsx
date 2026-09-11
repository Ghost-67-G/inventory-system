import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, isValid, subDays } from 'date-fns';
import { useMovementsReport } from '@/hooks/useReports';
import { reportsApi } from '@/api/endpoints/reports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';
import { ReportExportButton } from '@/components/reports/ReportExportButton';
import { ReportSummaryCard } from '@/components/reports/ReportSummaryCard';
import { useProducts } from '@/hooks/useProducts';
import { useWarehousesDropdown } from '@/hooks/useWarehouses';
import type { MovementsReportParams, IStockMovement } from '@/types';
import { createColumnHelper } from '@tanstack/react-table';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { useWindowSize } from '@/hooks/useWindowSize';

const columnHelper = createColumnHelper<IStockMovement>();

const MOVEMENT_TYPES = [
  { value: '', label: 'All movements' },
  { value: 'IN', label: 'In' },
  { value: 'OUT', label: 'Out' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'WASTE', label: 'Waste' },
  { value: 'TRANSFER', label: 'Transfer' }
];

const QUICK_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 }
];

const DATE_RANGE_ERROR = 'Start date must be on or before end date';

// The reports endpoints populate productId / warehouseId / performedBy in place
// (unlike the dashboard, which remaps them to product / warehouse / performedByUser),
// so accept either shape. Without this every row rendered as "—".
function getPopulated<T>(direct: T | undefined, raw: unknown): T | undefined {
  if (direct) return direct;
  return raw && typeof raw === 'object' ? (raw as T) : undefined;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return isValid(date) ? `${format(date, 'MMM d')} · ${format(date, 'HH:mm')}` : '—';
}

const isValidRange = (from: string, to: string) => !from || !to || from <= to;

export function MovementHistoryReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customDateFrom, setCustomDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [customDateTo, setCustomDateTo] = useState(searchParams.get('dateTo') || '');
  const [dateError, setDateError] = useState<string | null>(null);
  const { isMobile } = useWindowSize();

  // Get filter params from URL
  const params: MovementsReportParams = {
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    productId: searchParams.get('productId') || undefined,
    warehouseId: searchParams.get('warehouseId') || undefined,
    type: (searchParams.get('type') || undefined) as any,
    performedBy: searchParams.get('performedBy') || undefined,
    limit: 100
  };

  // Set default date range on mount
  useEffect(() => {
    if (!params.dateFrom && !params.dateTo) {
      const today = new Date();
      const thirtyDaysAgo = subDays(today, 30);
      const from = format(thirtyDaysAgo, 'yyyy-MM-dd');
      const to = format(today, 'yyyy-MM-dd');
      setCustomDateFrom(from);
      setCustomDateTo(to);
      updateParams({ dateFrom: from, dateTo: to });
    }
  }, []);

  const { data: infiniteData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMovementsReport(params);
  const { data: productsData } = useProducts({});
  const { data: warehouses } = useWarehousesDropdown();

  // Flatten products from infinite query pages
  const products = useMemo(
    () =>
      productsData?.pages
        .flatMap((page: any) => page?.products ?? [])
        .filter((p: any) => p && p._id) ?? [],
    [productsData]
  );

  const updateParams = (newParams: Partial<MovementsReportParams>) => {
    const updated = { ...params, ...newParams };
    const search = new URLSearchParams(searchParams);

    if (updated.dateFrom) search.set('dateFrom', updated.dateFrom);
    else search.delete('dateFrom');

    if (updated.dateTo) search.set('dateTo', updated.dateTo);
    else search.delete('dateTo');

    if (updated.productId) search.set('productId', updated.productId);
    else search.delete('productId');

    if (updated.warehouseId) search.set('warehouseId', updated.warehouseId);
    else search.delete('warehouseId');

    if (updated.type) search.set('type', updated.type);
    else search.delete('type');

    if (updated.performedBy) search.set('performedBy', updated.performedBy);
    else search.delete('performedBy');

    setSearchParams(search);
  };

  const applyPreset = (days: number) => {
    const today = new Date();
    const from = subDays(today, days);
    const fromStr = format(from, 'yyyy-MM-dd');
    const toStr = format(today, 'yyyy-MM-dd');
    setCustomDateFrom(fromStr);
    setCustomDateTo(toStr);
    setDateError(null);
    updateParams({ dateFrom: fromStr, dateTo: toStr });
  };

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    const nextFrom = field === 'dateFrom' ? value : customDateFrom;
    const nextTo = field === 'dateTo' ? value : customDateTo;
    if (field === 'dateFrom') setCustomDateFrom(value);
    else setCustomDateTo(value);

    if (!isValidRange(nextFrom, nextTo)) {
      setDateError(DATE_RANGE_ERROR);
      return;
    }
    setDateError(null);
    if (nextFrom && nextTo) updateParams({ dateFrom: nextFrom, dateTo: nextTo });
  };

  // Flatten paginated data
  const allMovements = useMemo(
    () =>
      infiniteData?.pages
        .flatMap((page) => page?.movements ?? [])
        .filter((movement): movement is IStockMovement => Boolean(movement && movement.createdAt)) ?? [],
    [infiniteData]
  );

  // Calculate summary from all movements
  const summary = useMemo(() => {
    const firstPageSummary = infiniteData?.pages[0]?.summary;
    if (!Array.isArray(firstPageSummary)) return null;
    return {
      totalMovements: firstPageSummary.reduce((sum: number, s: any) => sum + (s?.count ?? 0), 0),
      in: firstPageSummary.find((s: any) => s._id === 'IN')?.count ?? 0,
      out: firstPageSummary.find((s: any) => s._id === 'OUT')?.count ?? 0,
      adjustment: firstPageSummary.find((s: any) => s._id === 'ADJUSTMENT')?.count ?? 0,
      waste: firstPageSummary.find((s: any) => s._id === 'WASTE')?.count ?? 0
    };
  }, [infiniteData]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('createdAt', {
        header: 'Date & Time',
        cell: (info) => <span className="whitespace-nowrap text-sm">{formatDateTime(info.getValue())}</span>
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: (info) => {
          const type = info.getValue();
          const badgeClasses = {
            IN: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            OUT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            ADJUSTMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            WASTE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
            TRANSFER_IN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
            TRANSFER_OUT: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400'
          };
          return (
            <span className={`whitespace-nowrap px-2 py-1 rounded text-xs font-medium ${badgeClasses[type as keyof typeof badgeClasses] ?? 'bg-muted text-foreground'}`}>
              {String(type).replace('_', ' ')}
            </span>
          );
        }
      }),
      columnHelper.accessor((row) => row.productId, {
        id: 'product',
        header: 'Product',
        cell: (info) => {
          const product = getPopulated<any>(info.row.original.product, info.row.original.productId);
          return (
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium" title={product?.name}>{product?.name || '—'}</div>
              <div className="truncate text-muted-foreground text-xs">{product?.sku || '—'}</div>
            </div>
          );
        }
      }),
      columnHelper.accessor((row) => row.warehouseId, {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (info) => {
          const warehouse = getPopulated<any>(info.row.original.warehouse, info.row.original.warehouseId);
          return (
            <span className="text-sm">
              {warehouse ? `${warehouse.code ?? ''} ${warehouse.name ?? ''}`.trim() || '—' : '—'}
            </span>
          );
        }
      }),
      columnHelper.accessor('quantity', {
        header: 'Quantity',
        cell: (info) => {
          const type = info.row.original.type;
          const quantity = Math.abs(Number(info.getValue() ?? 0));
          const product = getPopulated<any>(info.row.original.product, info.row.original.productId);
          const isInbound = ['IN', 'TRANSFER_IN'].includes(type);
          // Adjustments can go either way; don't label them as outbound.
          const isAdjustment = type === 'ADJUSTMENT';
          const color = isAdjustment
            ? 'text-blue-600 dark:text-blue-400'
            : isInbound
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400';
          const sign = isAdjustment ? '±' : isInbound ? '+' : '-';
          return (
            <span className={`whitespace-nowrap font-medium ${color}`}>
              {sign}{quantity} {product?.unit ?? ''}
            </span>
          );
        }
      }),
      columnHelper.accessor('quantityAfter', {
        header: 'Stock After',
        cell: (info) => {
          const product = getPopulated<any>(info.row.original.product, info.row.original.productId);
          return (
            <span className="whitespace-nowrap text-sm">
              {info.getValue() ?? '—'} {product?.unit ?? ''}
            </span>
          );
        }
      }),
      columnHelper.accessor('note', {
        header: 'Note',
        cell: (info) => (
          <span className="block max-w-xs truncate text-sm text-muted-foreground" title={info.getValue()}>
            {info.getValue() || '—'}
          </span>
        )
      }),
      columnHelper.accessor((row) => row.performedBy, {
        id: 'performedBy',
        header: 'Performed By',
        cell: (info) => {
          const user = getPopulated<any>(info.row.original.performedByUser, info.row.original.performedBy);
          return <span className="text-sm">{user?.name || '—'}</span>;
        }
      })
    ],
    []
  );

  const canExport = Boolean(params.dateFrom && params.dateTo);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {QUICK_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant={
                params.dateTo === todayStr && params.dateFrom === format(subDays(new Date(), preset.days), 'yyyy-MM-dd')
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              onClick={() => applyPreset(preset.days)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="movement-date-from" className="text-sm font-medium text-foreground">From</label>
            <Input
              id="movement-date-from"
              type="date"
              value={customDateFrom}
              max={customDateTo || undefined}
              aria-invalid={dateError ? true : undefined}
              onChange={(e) => handleDateChange('dateFrom', e.target.value)}
              className="mt-1 min-w-0"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="movement-date-to" className="text-sm font-medium text-foreground">To</label>
            <Input
              id="movement-date-to"
              type="date"
              value={customDateTo}
              min={customDateFrom || undefined}
              aria-invalid={dateError ? true : undefined}
              onChange={(e) => handleDateChange('dateTo', e.target.value)}
              className="mt-1 min-w-0"
            />
          </div>
        </div>
        {dateError ? (
          <p role="alert" className="text-sm text-destructive">
            {dateError}
          </p>
        ) : null}
      </div>

      {/* Additional Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <select 
          aria-label="Filter by movement type"
          value={params.type || ''} 
          onChange={(e) => updateParams({ type: e.target.value as any || undefined })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {MOVEMENT_TYPES.map((mt) => (
            <option key={mt.value} value={mt.value}>{mt.label}</option>
          ))}
        </select>

        <select 
          aria-label="Filter by product"
          value={params.productId || ''} 
          onChange={(e) => updateParams({ productId: e.target.value || undefined })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All products</option>
          {products?.map((p: any) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>

        <select 
          aria-label="Filter by warehouse"
          value={params.warehouseId || ''} 
          onChange={(e) => updateParams({ warehouseId: e.target.value || undefined })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All warehouses</option>
          {warehouses?.map((w) => (
            <option key={w._id} value={w._id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Summary Pills */}
      {summary && (
        <div className="flex gap-2 flex-wrap">
          <ReportSummaryCard label="Total Movements" value={summary.totalMovements} accentColor="blue" />
          <ReportSummaryCard
            label="Stock In"
            value={summary.in}
            icon={TrendingUp}
            accentColor="green"
          />
          <ReportSummaryCard
            label="Stock Out"
            value={summary.out}
            icon={TrendingDown}
            accentColor="red"
          />
          {summary.adjustment > 0 && (
            <ReportSummaryCard label="Adjustments" value={summary.adjustment} accentColor="blue" />
          )}
          {summary.waste > 0 && (
            <ReportSummaryCard
              label="Waste"
              value={summary.waste}
              icon={AlertCircle}
              accentColor="amber"
            />
          )}
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <ReportExportButton
          onExport={() => reportsApi.exportMovements(params)}
          disabled={!canExport}
          disabledReason={!canExport ? 'Select a date range to export' : undefined}
          estimatedRows={allMovements.length}
        />
      </div>

      {/* Data Table with Infinite Scroll (DataTable renders its own border/rounding) */}
      <div>
        <DataTable
          columns={columns as any}
          data={allMovements}
          isLoading={isLoading}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onFetchNextPage={fetchNextPage}
          hiddenColumnIds={isMobile ? ['createdAt', 'warehouse', 'quantityAfter', 'note', 'performedBy'] : []}
          emptyMessage="No movements found"
        />
      </div>
    </div>
  );
}
