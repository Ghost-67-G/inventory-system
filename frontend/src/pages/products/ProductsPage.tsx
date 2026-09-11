import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { Filter, Plus, Search, RefreshCw, Upload, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import CategoryBadge from '@/components/shared/CategoryBadge';
import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import StockBadge from '@/components/shared/StockBadge';
import ProductFormDrawer from '@/components/products/ProductFormDrawer';
import ConfirmDeleteProductDialog from '@/components/products/ConfirmDeleteProductDialog';
import BulkCategoryModal from '@/components/products/BulkCategoryModal';
import { Button } from '@/components/ui/button';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useCategoriesDropdown } from '@/hooks/useCategories';
import { useProducts, useProductCount, useBulkUpdateProducts } from '@/hooks/useProducts';
import { useTenantFormatting } from '@/hooks/useTenantFormatting';
import { usePermission } from '@/hooks/usePermission';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import type { IProduct, ListProductsParams } from '@/types';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { formatMoney } = useTenantFormatting();
  const { canDo } = usePermission();
  const { data: categories } = useCategoriesDropdown();

  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<'true' | 'false' | 'all'>('true');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'totalStock' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const debouncedSearch = useDebounce(searchInput, 400);
  const { isMobile, isTablet } = useWindowSize();

  const [selectedProducts, setSelectedProducts] = useState<IProduct[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [editingProduct, setEditingProduct] = useState<IProduct | undefined>(undefined);
  const [deleteProduct, setDeleteProduct] = useState<IProduct | null>(null);
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  // DataTable owns its checkbox state and exposes no way to clear it, so we
  // remount it (via key) whenever selection is cleared programmatically.
  const [selectionResetKey, setSelectionResetKey] = useState(0);

  const bulkUpdateMutation = useBulkUpdateProducts();

  const clearSelection = useCallback(() => {
    setSelectedProducts([]);
    setSelectionResetKey((key) => key + 1);
  }, []);

  const params: ListProductsParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    isActive: isActiveFilter,
    lowStock: lowStockOnly ? 'true' : undefined,
    sortBy,
    sortOrder
  }), [debouncedSearch, categoryId, isActiveFilter, lowStockOnly, sortBy, sortOrder]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useProducts(params);
  const { data: productCount } = useProductCount(params);

  const allProducts = useMemo(
    () => data?.pages.flatMap((p) => p.products) ?? [],
    [data]
  ) as IProduct[];

  const hasActiveFilters = !!(debouncedSearch || categoryId || isActiveFilter !== 'true' || lowStockOnly);

  const clearFilters = () => {
    setSearchInput('');
    setCategoryId('');
    setIsActiveFilter('true');
    setLowStockOnly(false);
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  const handleRowClick = useCallback((product: IProduct) => {
    navigate(`/products/${product._id}`);
  }, [navigate]);

  const handleBulkDeactivate = async () => {
    if (!selectedProducts.length) return;
    try {
      await bulkUpdateMutation.mutateAsync({
        productIds: selectedProducts.map((p) => p._id),
        updates: { isActive: false }
      });
      clearSelection();
    } catch {
      // Error toast is handled by the mutation.
    }
  };

  const handleBulkActivate = async () => {
    if (!selectedProducts.length) return;
    try {
      await bulkUpdateMutation.mutateAsync({
        productIds: selectedProducts.map((p) => p._id),
        updates: { isActive: true }
      });
      clearSelection();
    } catch {
      // Error toast is handled by the mutation.
    }
  };

  const columns: ColumnDef<IProduct>[] = useMemo(() => [
    {
      id: 'sku',
      accessorKey: 'sku',
      header: 'SKU',
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
      )
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      size: 240,
      cell: ({ row }) => (
        <div>
          <div className="line-clamp-1 font-medium text-foreground">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">SKU: {row.original.sku}</div>
          {!isMobile && !isTablet && row.original.description ? (
            <div className="line-clamp-1 text-xs text-muted-foreground">{row.original.description}</div>
          ) : null}
        </div>
      )
    },
    {
      id: 'category',
      accessorKey: 'categoryId',
      header: 'Category',
      size: 140,
      cell: ({ row }) => {
        const cat = row.original.category;
        if (!cat) return <span className="text-xs text-muted-foreground">Uncategorized</span>;
        return <CategoryBadge name={cat.name} color={cat.color} size="sm" />;
      }
    },
    {
      id: 'unit',
      accessorKey: 'unit',
      header: 'Unit',
      size: 80,
      cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() as string}</span>
    },
    {
      id: 'stock',
      accessorKey: 'totalStock',
      header: 'Stock',
      size: 140,
      cell: ({ row }) => (
        <StockBadge
          stock={row.original.totalStock}
          threshold={row.original.lowStockThreshold}
          unit={row.original.unit}
        />
      )
    },
    {
      id: 'sellingPrice',
      accessorKey: 'sellingPrice',
      header: 'Price',
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground">{formatMoney(getValue() as number)}</span>
      )
    },
    {
      id: 'status',
      accessorKey: 'isActive',
      header: 'Status',
      size: 100,
      cell: ({ getValue }) => {
        const active = getValue() as boolean;
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              active
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {active ? 'Active' : 'Inactive'}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      size: 130,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canDo('product.update') && (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-50 hover:underline dark:text-blue-400 dark:hover:bg-blue-900/20"
              onClick={() => {
                setEditingProduct(row.original);
                setDrawerOpen(true);
              }}
            >
              Edit
            </button>
          )}
          {canDo('product.delete') && (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 hover:underline dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={() => setDeleteProduct(row.original)}
            >
              Delete
            </button>
          )}
        </div>
      )
    }
  ], [formatMoney, canDo, isMobile, isTablet]);

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={productCount !== undefined ? `${productCount.toLocaleString()} products` : undefined}
      >
        <div className="hidden items-center gap-2 md:flex">
          <PermissionGuard permission="product.create">
            <Button variant="outline" onClick={() => navigate('/products/import')}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="product.create">
            <Button
              onClick={() => {
                setEditingProduct(undefined);
                setDrawerOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Product
            </Button>
          </PermissionGuard>
        </div>
      </PageHeader>

      {/* Toolbar */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 md:min-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search products"
              className="h-11 w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground md:h-9 md:min-h-0"
              placeholder="Search by name, SKU, or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && isLoading && (
              <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 md:hidden"
            aria-expanded={showMobileFilters}
            onClick={() => setShowMobileFilters((value) => !value)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>

          <div className={`${showMobileFilters ? 'grid' : 'hidden'} w-full grid-cols-1 gap-2 md:flex md:w-auto md:flex-wrap md:items-center md:gap-2`}>
            <select
              aria-label="Filter by category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-11 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground md:h-9 md:min-h-0"
            >
              <option value="">All categories</option>
              {categories?.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by status"
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value as 'true' | 'false' | 'all')}
              className="h-11 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground md:h-9 md:min-h-0"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="all">All</option>
            </select>

            <button
              type="button"
              aria-pressed={lowStockOnly}
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`h-11 rounded-lg border px-3 py-2 text-sm transition-colors md:h-9 md:min-h-0 ${
                lowStockOnly
                  ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'border-input bg-background text-foreground hover:bg-muted'
              }`}
            >
              Low stock only
            </button>

            <select
              aria-label="Sort products"
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split(':');
                setSortBy(by as 'name' | 'sku' | 'totalStock' | 'createdAt');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="h-11 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground md:h-9 md:min-h-0"
            >
              <option value="createdAt:desc">Newest first</option>
              <option value="createdAt:asc">Oldest first</option>
              <option value="name:asc">Name A-Z</option>
              <option value="name:desc">Name Z-A</option>
              <option value="totalStock:asc">Stock low-high</option>
              <option value="totalStock:desc">Stock high-low</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:h-auto"
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {selectedProducts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-900/20">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {selectedProducts.length} selected
            </span>
            {canDo('product.update') && (
              <>
                <button
                  type="button"
                  className="rounded border border-input bg-background px-3 py-1 text-sm text-foreground hover:bg-muted disabled:opacity-50 md:ml-2"
                  disabled={bulkUpdateMutation.isPending}
                  onClick={() => setBulkCategoryModalOpen(true)}
                >
                  Change category
                </button>
                <button
                  type="button"
                  className="rounded border border-input bg-background px-3 py-1 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                  disabled={bulkUpdateMutation.isPending}
                  onClick={() => void handleBulkDeactivate()}
                >
                  Deactivate
                </button>
                <button
                  type="button"
                  className="rounded border border-input bg-background px-3 py-1 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                  disabled={bulkUpdateMutation.isPending}
                  onClick={() => void handleBulkActivate()}
                >
                  Activate
                </button>
              </>
            )}
            <button
              type="button"
              className="ml-auto text-sm text-blue-600 hover:underline dark:text-blue-400"
              onClick={clearSelection}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      <DataTable
        key={selectionResetKey}
        columns={columns}
        data={allProducts}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        onFetchNextPage={() => void fetchNextPage()}
        onRowClick={handleRowClick}
        getRowId={(row) => row._id}
        enableRowSelection={canDo('product.update') || canDo('product.delete')}
        onSelectionChange={setSelectedProducts}
        emptyMessage={hasActiveFilters ? 'No products match your filters' : 'No products yet'}
        hiddenColumnIds={
          isMobile
            ? ['sku', 'category', 'unit', 'sellingPrice', 'status']
            : isTablet
              ? ['sellingPrice', 'category']
              : []
        }
        maxHeight={isMobile ? 'calc(100dvh - 160px)' : 'calc(100dvh - 280px)'}
      />

      <FloatingActionButton
        onClick={() => {
          setEditingProduct(undefined);
          setDrawerOpen(true);
        }}
        icon={Plus}
        label="Add product"
        permission="product.create"
      />

      <ProductFormDrawer
        mode={editingProduct ? 'edit' : 'create'}
        product={editingProduct}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingProduct(undefined);
        }}
      />

      <ConfirmDeleteProductDialog
        product={deleteProduct}
        open={!!deleteProduct}
        onOpenChange={(open) => {
          if (!open) setDeleteProduct(null);
        }}
        onSuccess={() => {
          // Drop the deleted row from any pending bulk selection.
          if (deleteProduct && selectedProducts.some((p) => p._id === deleteProduct._id)) {
            setSelectedProducts((prev) => prev.filter((p) => p._id !== deleteProduct._id));
            setSelectionResetKey((key) => key + 1);
          }
        }}
      />

      <BulkCategoryModal
        productIds={selectedProducts.map((p) => p._id)}
        open={bulkCategoryModalOpen}
        onOpenChange={setBulkCategoryModalOpen}
        onSuccess={clearSelection}
      />
    </div>
  );
}
