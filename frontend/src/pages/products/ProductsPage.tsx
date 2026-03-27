import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Search, RefreshCw, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import CategoryBadge from '@/components/shared/CategoryBadge';
import StockBadge from '@/components/shared/StockBadge';
import ProductFormDrawer from '@/components/products/ProductFormDrawer';
import ConfirmDeleteProductDialog from '@/components/products/ConfirmDeleteProductDialog';
import BulkCategoryModal from '@/components/products/BulkCategoryModal';
import { Button } from '@/components/ui/button';
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

  const [selectedProducts, setSelectedProducts] = useState<IProduct[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<IProduct | undefined>(undefined);
  const [deleteProduct, setDeleteProduct] = useState<IProduct | null>(null);
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);

  const bulkUpdateMutation = useBulkUpdateProducts();

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
    await bulkUpdateMutation.mutateAsync({
      productIds: selectedProducts.map((p) => p._id),
      updates: { isActive: false }
    });
    setSelectedProducts([]);
  };

  const handleBulkActivate = async () => {
    if (!selectedProducts.length) return;
    await bulkUpdateMutation.mutateAsync({
      productIds: selectedProducts.map((p) => p._id),
      updates: { isActive: true }
    });
    setSelectedProducts([]);
  };

  const columns: ColumnDef<IProduct>[] = useMemo(() => [
    {
      id: 'sku',
      accessorKey: 'sku',
      header: 'SKU',
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-gray-500">{getValue() as string}</span>
      )
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      size: 240,
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900 line-clamp-1">{row.original.name}</div>
          {row.original.description && (
            <div className="text-xs text-gray-500 line-clamp-1">{row.original.description}</div>
          )}
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
        if (!cat) return <span className="text-xs text-gray-400">Uncategorized</span>;
        return <CategoryBadge name={cat.name} color={cat.color} size="sm" />;
      }
    },
    {
      id: 'unit',
      accessorKey: 'unit',
      header: 'Unit',
      size: 80,
      cell: ({ getValue }) => <span className="text-sm text-gray-600">{getValue() as string}</span>
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
        <span className="font-medium">{formatMoney(getValue() as number)}</span>
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
              active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
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
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {canDo('product.update') && (
            <button
              className="text-xs text-blue-600 hover:underline"
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
              className="text-xs text-red-500 hover:underline"
              onClick={() => setDeleteProduct(row.original)}
            >
              Delete
            </button>
          )}
        </div>
      )
    }
  ], [formatMoney, canDo]);

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={productCount !== undefined ? `${productCount.toLocaleString()} products` : undefined}
      >
        <div className="flex items-center gap-2">
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
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-input bg-white pl-9 pr-4 py-2 text-sm"
              placeholder="Search by name, SKU, or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && isLoading && (
              <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 animate-spin" />
            )}
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-input bg-white px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories?.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={isActiveFilter}
            onChange={(e) => setIsActiveFilter(e.target.value as 'true' | 'false' | 'all')}
            className="rounded-lg border border-input bg-white px-3 py-2 text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="all">All</option>
          </select>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
              lowStockOnly
                ? 'bg-amber-100 border-amber-300 text-amber-700'
                : 'border-input bg-white text-gray-700'
            }`}
          >
            Low stock only
          </button>

          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split(':');
              setSortBy(by as 'name' | 'sku' | 'totalStock' | 'createdAt');
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="rounded-lg border border-input bg-white px-3 py-2 text-sm"
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
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>

        {selectedProducts.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2">
            <span className="text-sm font-medium text-blue-700">
              {selectedProducts.length} selected
            </span>
            <button
              className="ml-2 rounded px-3 py-1 bg-white border text-sm hover:bg-gray-50"
              onClick={() => setBulkCategoryModalOpen(true)}
            >
              Change category
            </button>
            <button
              className="rounded px-3 py-1 bg-white border text-sm hover:bg-gray-50"
              onClick={() => void handleBulkDeactivate()}
            >
              Deactivate
            </button>
            <button
              className="rounded px-3 py-1 bg-white border text-sm hover:bg-gray-50"
              onClick={() => void handleBulkActivate()}
            >
              Activate
            </button>
            <button
              className="ml-auto text-sm text-blue-600 hover:underline"
              onClick={() => setSelectedProducts([])}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      <DataTable
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
      />

      <BulkCategoryModal
        productIds={selectedProducts.map((p) => p._id)}
        open={bulkCategoryModalOpen}
        onOpenChange={setBulkCategoryModalOpen}
        onSuccess={() => setSelectedProducts([])}
      />
    </div>
  );
}
