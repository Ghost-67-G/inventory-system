import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { useMovementsReport } from '@/hooks/useReports';
import { reportsApi } from '@/api/endpoints/reports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';
import { ReportExportButton } from '@/components/reports/ReportExportButton';
import { ReportSummaryCard } from '@/components/reports/ReportSummaryCard';
import { useProducts } from '@/hooks/useProducts';
import { useWarehousesDropdown } from '@/hooks/useWarehouses';
import { formatCurrency } from '@/lib/formatting';
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

export function MovementHistoryReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customDateFrom, setCustomDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [customDateTo, setCustomDateTo] = useState(searchParams.get('dateTo') || '');
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

  const { data: infiniteData, fetchNextPage, hasNextPage, isFetchingNextPage } = useMovementsReport(params);
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
    updateParams({ dateFrom: fromStr, dateTo: toStr });
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
    if (!infiniteData?.pages[0]?.summary) return null;
    const firstPageSummary = infiniteData.pages[0].summary;
    return {
      totalMovements: firstPageSummary.reduce((sum: number, s: any) => sum + s.count, 0),
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
        cell: (info) => {
          const date = new Date(info.getValue());
          return (
            <span className="text-sm">
              {format(date, 'MMM d')} · {format(date, 'HH:mm')}
            </span>
          );
        }
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
            <span className={`px-2 py-1 rounded text-xs font-medium ${badgeClasses[type as keyof typeof badgeClasses]}`}>
              {type}
            </span>
          );
        }
      }),
      columnHelper.accessor((row) => row.productId, {
        id: 'product',
        header: 'Product',
        cell: (info) => {
          const product = info.row.original.product as any;
          return (
            <div className="text-sm">
              <div className="font-medium">{product?.name || '—'}</div>
              <div className="text-muted-foreground text-xs">{product?.sku || '—'}</div>
            </div>
          );
        }
      }),
      columnHelper.accessor((row) => row.warehouseId, {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (info) => {
          const warehouse = info.row.original.warehouse as any;
          return (
            <span className="text-sm">
              {warehouse?.code} {warehouse?.name}
            </span>
          );
        }
      }),
      columnHelper.accessor('quantity', {
        header: 'Quantity',
        cell: (info) => {
          const type = info.row.original.type;
          const quantity = info.getValue();
          const product = info.row.original.product as any;
          const color =
            ['IN', 'TRANSFER_IN'].includes(type) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
          return (
            <span className={`font-medium ${color}`}>
              {['IN', 'TRANSFER_IN'].includes(type) ? '+' : '-'}{quantity} {product?.unit}
            </span>
          );
        }
      }),
      columnHelper.accessor('quantityAfter', {
        header: 'Stock After',
        cell: (info) => {
          const product = info.row.original.product as any;
          return (
            <span className="text-sm">
              {info.getValue()} {product?.unit}
            </span>
          );
        }
      }),
      columnHelper.accessor('note', {
        header: 'Note',
        cell: (info) => (
          <span className="text-sm text-muted-foreground truncate max-w-xs" title={info.getValue()}>
            {info.getValue() || '—'}
          </span>
        )
      }),
      columnHelper.accessor((row) => row.performedBy, {
        id: 'performedBy',
        header: 'Performed By',
        cell: (info) => {
          const user = info.row.original.performedBy as any;
          return <span className="text-sm">{user?.name || '—'}</span>;
        }
      })
    ],
    []
  );

  const canExport = params.dateFrom && params.dateTo;

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {QUICK_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant={
                params.dateFrom === format(subDays(new Date(), preset.days), 'yyyy-MM-dd')
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">From</label>
            <Input
              type="date"
              value={customDateFrom}
              onChange={(e) => {
                setCustomDateFrom(e.target.value);
                if (customDateTo) updateParams({ dateFrom: e.target.value, dateTo: customDateTo });
              }}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">To</label>
            <Input
              type="date"
              value={customDateTo}
              onChange={(e) => {
                setCustomDateTo(e.target.value);
                if (customDateFrom) updateParams({ dateFrom: customDateFrom, dateTo: e.target.value });
              }}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Additional Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <select 
          value={params.type || ''} 
          onChange={(e) => updateParams({ type: e.target.value as any || undefined })}
          className="px-3 py-2 border rounded-md text-sm"
        >
          {MOVEMENT_TYPES.map((mt) => (
            <option key={mt.value} value={mt.value}>{mt.label}</option>
          ))}
        </select>

        <select 
          value={params.productId || ''} 
          onChange={(e) => updateParams({ productId: e.target.value || undefined })}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">All products</option>
          {products?.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>

        <select 
          value={params.warehouseId || ''} 
          onChange={(e) => updateParams({ warehouseId: e.target.value || undefined })}
          className="px-3 py-2 border rounded-md text-sm"
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

      {/* Data Table with Infinite Scroll */}
      <div className="border rounded-lg overflow-hidden">
        <DataTable
          columns={columns as any}
          data={allMovements}
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
