import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useLowStockReport } from '@/hooks/useReports';
import { reportsApi } from '@/api/endpoints/reports';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/DataTable';
import CategoryBadge from '@/components/shared/CategoryBadge';
import { WarehouseBadge } from '@/components/shared/WarehouseBadge';
import { ReportExportButton } from '@/components/reports/ReportExportButton';
import { ReportSummaryCard } from '@/components/reports/ReportSummaryCard';
import { useCategoriesDropdown } from '@/hooks/useCategories';
import { useWarehousesDropdown } from '@/hooks/useWarehouses';
import { formatCurrency } from '@/lib/formatting';
import type { LowStockRow, LowStockParams } from '@/types';
import { createColumnHelper } from '@tanstack/react-table';
import { AlertCircle, AlertTriangle, Package } from 'lucide-react';

const columnHelper = createColumnHelper<LowStockRow>();

export function LowStockReport() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params: LowStockParams = {
    categoryId: searchParams.get('categoryId') || undefined,
    warehouseId: searchParams.get('warehouseId') || undefined,
    sortBy: (searchParams.get('sortBy') || 'shortage') as any,
    sortOrder: (searchParams.get('sortOrder') || 'desc') as any
  };

  const { data, isLoading } = useLowStockReport(params);
  const { data: categories } = useCategoriesDropdown();
  const { data: warehouses } = useWarehousesDropdown();

  const updateParams = (newParams: Partial<LowStockParams>) => {
    const updated = { ...params, ...newParams };
    const search = new URLSearchParams();
    if (updated.categoryId) search.set('categoryId', updated.categoryId as string);
    if (updated.warehouseId) search.set('warehouseId', updated.warehouseId as string);
    if (updated.sortBy !== 'shortage') search.set('sortBy', String(updated.sortBy));
    if (updated.sortOrder !== 'desc') search.set('sortOrder', String(updated.sortOrder));
    setSearchParams(search);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('sku', {
        header: 'SKU',
        cell: (info) => <span className="font-mono text-sm">{info.getValue()}</span>,
        size: 100
      }),
      columnHelper.accessor('productName', {
        header: 'Product Name',
        cell: (info) => <span className="font-medium">{info.getValue()}</span>
      }),
      columnHelper.accessor('categoryName', {
        header: 'Category',
        cell: (info) => {
          const row = info.row.original;
          return (
            <CategoryBadge name={row.categoryName} color={row.categoryColor} />
          );
        }
      }),
      columnHelper.accessor('warehouseCode', {
        header: 'Warehouse',
        cell: (info) => {
          const row = info.row.original;
          return (
            <WarehouseBadge name={row.warehouseName} code={row.warehouseCode} />
          );
        }
      }),
      columnHelper.accessor('unit', {
        header: 'Unit',
        size: 80
      }),
      columnHelper.accessor('currentStock', {
        header: 'Current Stock',
        cell: (info) => {
          const stock = info.getValue();
          return (
            <span className={stock === 0 ? 'font-bold text-red-600' : 'font-medium'}>
              {stock}
            </span>
          );
        }
      }),
      columnHelper.accessor('threshold', {
        header: 'Threshold',
        cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>
      }),
      columnHelper.accessor('shortage', {
        header: 'Shortage',
        cell: (info) => <span className="font-bold text-red-600">{info.getValue()}</span>
      }),
      columnHelper.accessor('reorderSuggestion', {
        header: 'Reorder Suggestion',
        cell: (info) => (
          <span className="font-medium text-blue-600">{info.getValue()}</span>
        )
      }),
      columnHelper.accessor('restockCost', {
        header: 'Estimated Restock Cost',
        cell: (info) => (
          <span className="text-muted-foreground">{formatCurrency(info.getValue(), 'USD')}</span>
        )
      })
    ],
    []
  );

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  // Empty state — positive styling
  if (!isLoading && rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <CheckCircle className="h-16 w-16 text-green-600 mb-4" />
        <h3 className="mb-2 text-lg font-bold text-foreground">No Low Stock Items</h3>
        <p className="max-w-md text-center text-muted-foreground">
          Your inventory is healthy! All products are stocked above their thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <select 
          value={params.categoryId || ''} 
          onChange={(e) => updateParams({ categoryId: e.target.value || undefined })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        <select 
          value={params.warehouseId || ''} 
          onChange={(e) => updateParams({ warehouseId: e.target.value || undefined })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All warehouses</option>
          {warehouses?.map((w) => (
            <option key={w._id} value={w._id}>{w.name}</option>
          ))}
        </select>

        <select 
          value={params.sortBy} 
          onChange={(e) => updateParams({ sortBy: e.target.value as any })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="shortage">Shortage (Most Urgent)</option>
          <option value="currentStock">Current Stock</option>
          <option value="name">Name</option>
        </select>

        <div className="flex gap-2">
          <Button
            variant={params.sortOrder === 'asc' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateParams({ sortOrder: 'asc' })}
          >
            Asc
          </Button>
          <Button
            variant={params.sortOrder === 'desc' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateParams({ sortOrder: 'desc' })}
          >
            Desc
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ReportSummaryCard
            label="Total Low Stock Items"
            value={summary.totalItems}
            icon={Package}
            accentColor="blue"
          />
          <ReportSummaryCard
            label="Out of Stock"
            value={summary.outOfStock}
            icon={AlertTriangle}
            accentColor="red"
          />
          <ReportSummaryCard
            label="Critical Items"
            value={summary.criticalItems}
            subLabel="≤25% of threshold"
            icon={AlertCircle}
            accentColor="amber"
          />
          <ReportSummaryCard
            label="Restock Cost"
            value={formatCurrency(summary.totalRestockCost, 'USD')}
            accentColor="blue"
          />
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <ReportExportButton onExport={() => reportsApi.exportLowStock(params)} estimatedRows={rows.length} />
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <DataTable
          columns={columns as any}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No low stock items"
        />
      </div>
    </div>
  );
}
