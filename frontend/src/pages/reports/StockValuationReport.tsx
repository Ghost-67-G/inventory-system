import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useStockValuation } from '@/hooks/useReports';
import { reportsApi } from '@/api/endpoints/reports';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/DataTable';
import CategoryBadge from '@/components/shared/CategoryBadge';
import { ReportExportButton } from '@/components/reports/ReportExportButton';
import { ReportSummaryCard } from '@/components/reports/ReportSummaryCard';
import { useCategoriesDropdown } from '@/hooks/useCategories';
import { useWarehousesDropdown } from '@/hooks/useWarehouses';
import { formatCurrency } from '@/lib/formatting';
import type { StockValuationRow, StockValuationParams } from '@/types';
import { createColumnHelper } from '@tanstack/react-table';

const columnHelper = createColumnHelper<StockValuationRow>();

export function StockValuationReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedWarehouseId, setExpandedWarehouseId] = useState<string | null>(null);

  // Get filter params from URL
  const params: StockValuationParams = {
    categoryId: searchParams.get('categoryId') || undefined,
    warehouseId: searchParams.get('warehouseId') || undefined,
    isActive: (searchParams.get('isActive') || 'true') as 'true' | 'false',
    sortBy: (searchParams.get('sortBy') || 'stockValue') as any,
    sortOrder: (searchParams.get('sortOrder') || 'desc') as any
  };

  const { data, isLoading } = useStockValuation(params);
  const { data: categories } = useCategoriesDropdown();
  const { data: warehouses } = useWarehousesDropdown();

  // Update URL when filters change
  const updateParams = (newParams: Partial<StockValuationParams>) => {
    const updated = { ...params, ...newParams };
    const search = new URLSearchParams();
    if (updated.categoryId) search.set('categoryId', updated.categoryId as string);
    if (updated.warehouseId) search.set('warehouseId', updated.warehouseId as string);
    if (updated.isActive !== 'true') search.set('isActive', String(updated.isActive));
    if (updated.sortBy !== 'stockValue') search.set('sortBy', String(updated.sortBy));
    if (updated.sortOrder !== 'desc') search.set('sortOrder', String(updated.sortOrder));
    setSearchParams(search);
  };

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.accessor('sku', {
        header: 'SKU',
        cell: (info) => <span className="font-mono text-sm">{info.getValue()}</span>,
        size: 100
      }),
      columnHelper.accessor('name', {
        header: 'Product Name',
        cell: (info) => <span className="font-medium">{info.getValue()}</span>
      }),
      columnHelper.accessor('category', {
        header: 'Category',
        cell: (info) => {
          const cat = info.getValue();
          return cat ? (
            <CategoryBadge name={cat.name} color={cat.color} />
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        }
      }),
      columnHelper.accessor('unit', {
        header: 'Unit',
        size: 80
      }),
      columnHelper.accessor('costPrice', {
        header: 'Cost Price',
        cell: (info) => formatCurrency(info.getValue(), 'USD')
      }),
      columnHelper.accessor('sellingPrice', {
        header: 'Selling Price',
        cell: (info) => formatCurrency(info.getValue(), 'USD')
      }),
      columnHelper.accessor('margin', {
        header: 'Margin %',
        cell: (info) => {
          const margin = info.getValue();
          const color =
            margin >= 20 ? 'text-green-600' : margin >= 0 ? 'text-amber-600' : 'text-red-600';
          return <span className={color}>{(margin ?? 0).toFixed(1)}%</span>;
        }
      }),
      columnHelper.accessor('effectiveStock', {
        header: 'Total Stock',
        cell: (info) => <span className="font-medium">{info.getValue()}</span>
      }),
      columnHelper.accessor('stockValue', {
        header: 'Stock Value',
        cell: (info) => (
          <span className="font-bold">{formatCurrency(info.getValue(), 'USD')}</span>
        )
      }),
      columnHelper.accessor('potentialRevenue', {
        header: 'Potential Revenue',
        cell: (info) => (
          <span className="text-muted-foreground">{formatCurrency(info.getValue(), 'USD')}</span>
        )
      }),
      columnHelper.accessor('warehouseBreakdown', {
        header: 'Warehouses',
        cell: (info) => {
          const breakdown = info.getValue();
          if (!breakdown || breakdown.length === 0) return <span className="text-muted-foreground">—</span>;
          if (breakdown.length === 1) {
            const w = breakdown[0];
            return <span className="text-sm">{w.quantity} @ {w.warehouseCode}</span>;
          }
          const rowId = info.row.id;
          const isExpanded = expandedWarehouseId === rowId;
          return (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedWarehouseId(isExpanded ? null : rowId)}
                className="gap-1"
              >
                {breakdown.length} warehouses
                <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </Button>
              {isExpanded && (
                <div className="space-y-1 text-sm">
                  {breakdown.map((w, idx) => (
                    <div key={idx} className="ml-2 text-muted-foreground">
                      {w.warehouseCode}: {w.quantity}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
      })
    ],
    [expandedWarehouseId]
  );

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <select 
          value={params.categoryId || ''} 
          onChange={(e) => updateParams({ categoryId: e.target.value || undefined })}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
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

        <select 
          value={params.isActive} 
          onChange={(e) => updateParams({ isActive: e.target.value as 'true' | 'false' })}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <select 
          value={params.sortBy} 
          onChange={(e) => updateParams({ sortBy: e.target.value as any })}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="stockValue">Stock Value</option>
          <option value="totalStock">Total Stock</option>
          <option value="name">Name</option>
          <option value="sku">SKU</option>
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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <ReportSummaryCard
            label="Total Products"
            value={summary.totalProducts}
            accentColor="blue"
          />
          <ReportSummaryCard
            label="Total Stock"
            value={summary.totalUnits}
            accentColor="green"
          />
          <ReportSummaryCard
            label="Stock Value"
            value={formatCurrency(summary.totalStockValue, 'USD')}
            accentColor="blue"
          />
          <ReportSummaryCard
            label="Potential Revenue"
            value={formatCurrency(summary.totalPotentialRevenue, 'USD')}
            accentColor="purple"
          />
          <ReportSummaryCard
            label="Avg Margin"
            value={`${(summary.avgMargin ?? 0).toFixed(1)}%`}
            accentColor="green"
          />
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-between items-center">
        <div>
          {rows.length >= 100 && (
            <p className="text-sm text-muted-foreground">
              Preview shows first 100 rows. Export includes all {summary?.totalProducts} products.
            </p>
          )}
        </div>
        <ReportExportButton
          onExport={() => reportsApi.exportStockValuation(params)}
          estimatedRows={summary?.totalProducts}
        />
      </div>

      {/* Data Table */}
      <div className="border rounded-lg overflow-hidden">
        <DataTable columns={columns as any} data={rows} isLoading={isLoading} emptyMessage="No products found" />
      </div>
    </div>
  );
}
