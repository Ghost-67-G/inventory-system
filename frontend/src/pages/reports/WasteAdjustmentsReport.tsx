import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, isValid, subDays } from 'date-fns';
import { useWasteAdjustmentsReport } from '@/hooks/useReports';
import { reportsApi } from '@/api/endpoints/reports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';
import { WarehouseBadge } from '@/components/shared/WarehouseBadge';
import { ReportExportButton } from '@/components/reports/ReportExportButton';
import { ReportSummaryCard } from '@/components/reports/ReportSummaryCard';
import { useProducts } from '@/hooks/useProducts';
import { useWarehousesDropdown } from '@/hooks/useWarehouses';
import { useTenantFormatting } from '@/hooks/useTenantFormatting';
import { formatCurrency } from '@/lib/formatting';
import type { WasteAdjustmentsParams, IStockMovement } from '@/types';
import { createColumnHelper } from '@tanstack/react-table';
import { AlertTriangle, Repeat2, Trash2 } from 'lucide-react';

const columnHelper = createColumnHelper<IStockMovement>();

const DATE_RANGE_ERROR = 'Start date must be on or before end date';

// The reports endpoints populate productId / warehouseId / performedBy in place
// (unlike the dashboard, which remaps them to product / warehouse / performedByUser),
// so accept either shape. Without this every row rendered as "—" and $0.00.
function getPopulated<T>(direct: T | undefined, raw: unknown): T | undefined {
  if (direct) return direct;
  return raw && typeof raw === 'object' ? (raw as T) : undefined;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return isValid(date) ? `${format(date, 'MMM d')} · ${format(date, 'HH:mm')}` : '—';
}

const isValidRange = (from: string, to: string) => !from || !to || from <= to;

export function WasteAdjustmentsReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customDateFrom, setCustomDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [customDateTo, setCustomDateTo] = useState(searchParams.get('dateTo') || '');
  const [dateError, setDateError] = useState<string | null>(null);
  const { currency } = useTenantFormatting();

  const params: WasteAdjustmentsParams = {
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    productId: searchParams.get('productId') || undefined,
    warehouseId: searchParams.get('warehouseId') || undefined,
    type: (searchParams.get('type') || undefined) as any,
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

  const { data: infiniteData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useWasteAdjustmentsReport(params);
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

  const updateParams = (newParams: Partial<WasteAdjustmentsParams>) => {
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

    setSearchParams(search);
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

  // Get summary from first page
  const summary = infiniteData?.pages[0]?.summary;

  const columns = useMemo(
    () => [
      columnHelper.accessor('createdAt', {
        header: 'Date',
        cell: (info) => <span className="whitespace-nowrap text-sm">{formatDateTime(info.getValue())}</span>
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: (info) => {
          const type = info.getValue();
          if (type === 'WASTE') {
            return (
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  Waste
                </span>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-2">
              <Repeat2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                Adjustment
              </span>
            </div>
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
            <WarehouseBadge name={warehouse?.name || '—'} code={warehouse?.code || '—'} />
          );
        }
      }),
      columnHelper.accessor('quantity', {
        header: 'Quantity',
        cell: (info) => {
          const type = info.row.original.type;
          const quantity = Math.abs(Number(info.getValue() ?? 0));
          const product = getPopulated<any>(info.row.original.product, info.row.original.productId);
          const color = type === 'WASTE' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400';
          return (
            <span className={`whitespace-nowrap font-medium ${color}`}>
              {type === 'WASTE' ? '-' : '±'}{quantity} {product?.unit ?? ''}
            </span>
          );
        }
      }),
      columnHelper.accessor((row: IStockMovement) => row.quantity, {
        id: 'estimatedValue',
        header: 'Estimated Value',
        cell: (info) => {
          const type = info.row.original.type;
          const quantity = Math.abs(Number(info.getValue() ?? 0));
          const product = getPopulated<any>(info.row.original.product, info.row.original.productId);
          const costPrice = Number(product?.costPrice ?? 0);
          const value = Number.isFinite(quantity * costPrice) ? quantity * costPrice : 0;
          const color = type === 'WASTE' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';
          return (
            <span className={`whitespace-nowrap ${color}`}>
              {formatCurrency(value, currency)}
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
    [currency]
  );

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="waste-date-from" className="text-sm font-medium text-foreground">From</label>
            <Input
              id="waste-date-from"
              type="date"
              value={customDateFrom}
              max={customDateTo || undefined}
              aria-invalid={dateError ? true : undefined}
              onChange={(e) => handleDateChange('dateFrom', e.target.value)}
              className="mt-1 min-w-0"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="waste-date-to" className="text-sm font-medium text-foreground">To</label>
            <Input
              id="waste-date-to"
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

      {/* Type Filter */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <select 
          aria-label="Filter by type"
          value={params.type || ''} 
          onChange={(e) => updateParams({ type: e.target.value as any || undefined })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All types</option>
          <option value="WASTE">Waste Only</option>
          <option value="ADJUSTMENT">Adjustments Only</option>
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

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <ReportSummaryCard
              label="Waste Events"
              value={summary.waste?.count ?? 0}
              icon={Trash2}
              accentColor="red"
            />
            <ReportSummaryCard
              label="Waste Quantity"
              value={`${summary.waste?.totalQuantity ?? 0} units`}
              accentColor="red"
            />
            <ReportSummaryCard
              label="Waste Value"
              value={formatCurrency(summary.waste?.totalValue ?? 0, currency)}
              accentColor="red"
            />
          </div>

          <div className="space-y-2">
            <ReportSummaryCard
              label="Adjustments"
              value={summary.adjustment?.count ?? 0}
              icon={Repeat2}
              accentColor="blue"
            />
            <ReportSummaryCard
              label="Adjustment Qty"
              value={`${summary.adjustment?.totalQuantity ?? 0} units`}
              accentColor="blue"
            />
            <ReportSummaryCard
              label="Adjustment Value"
              value={formatCurrency(summary.adjustment?.totalValue ?? 0, currency)}
              accentColor="blue"
            />
          </div>
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <ReportExportButton onExport={() => reportsApi.exportWasteAdjustments(params)} estimatedRows={allMovements.length} />
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
          emptyMessage="No waste or adjustment records found"
        />
      </div>
    </div>
  );
}
