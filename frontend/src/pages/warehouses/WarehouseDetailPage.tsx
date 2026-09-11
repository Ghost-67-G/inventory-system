import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Star, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import { WarehouseFormModal } from '@/components/warehouses/WarehouseFormModal';
import { ConfirmDeactivateWarehouseDialog } from '@/components/warehouses/ConfirmDeactivateWarehouseDialog';
import { useWarehouse, useWarehouseStock, useSetDefaultWarehouse } from '@/hooks/useWarehouses';
import { useCategoriesDropdown } from '@/hooks/useCategories';
import CategoryBadge from '@/components/shared/CategoryBadge';
import { DataTable } from '@/components/shared/DataTable';
import { useWindowSize } from '@/hooks/useWindowSize';
import type { ColumnDef } from '@tanstack/react-table';
import type { WarehouseStockItem } from '@/types';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [formModal, setFormModal] = useState(false);
  const [deactivateDialog, setDeactivateDialog] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const { isMobile } = useWindowSize();

  const { data: warehouse, isLoading } = useWarehouse(id || '');
  const {
    data: stockPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isStockLoading
  } = useWarehouseStock(
    id || '',
    { search: debouncedSearch || undefined, lowStock: showLowStockOnly ? 'true' : undefined }
  );
  const setDefaultMutation = useSetDefaultWarehouse();
  const { data: categoryOptions } = useCategoriesDropdown();

  // The stock endpoint only returns categoryId; resolve it to a name/colour instead of showing a raw id.
  const categoriesById = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    (categoryOptions ?? []).forEach((category) => map.set(category._id, { name: category.name, color: category.color }));
    return map;
  }, [categoryOptions]);

  const columns = useMemo<ColumnDef<WarehouseStockItem>[]>(
    () => [
      {
        id: 'name',
        header: 'Product',
        size: 260,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.product?.name ?? 'Unknown product'}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.product?.sku ?? '—'}</p>
          </div>
        )
      },
      {
        id: 'category',
        header: 'Category',
        size: 170,
        cell: ({ row }) => {
          const categoryId = row.original.product?.categoryId;
          const category = categoryId ? categoriesById.get(categoryId) : undefined;
          if (category) {
            return <CategoryBadge name={category.name} color={category.color} size="sm" />;
          }
          return <span className="text-xs text-muted-foreground">Uncategorized</span>;
        }
      },
      {
        id: 'unit',
        header: 'Unit',
        size: 90,
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.product?.unit ?? '—'}</span>
      },
      {
        id: 'quantity',
        header: 'In Stock',
        size: 120,
        cell: ({ row }) => {
          const low = row.original.quantity <= (row.original.product?.lowStockThreshold ?? 0);
          return low ? (
            <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {row.original.quantity}
            </span>
          ) : (
            <span>{row.original.quantity}</span>
          );
        }
      },
      {
        id: 'reserved',
        header: 'Reserved',
        size: 120,
        cell: ({ row }) =>
          row.original.reservedQuantity > 0 ? (
            <span className="text-muted-foreground">{row.original.reservedQuantity}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
      },
      {
        id: 'available',
        header: 'Available',
        size: 120,
        cell: ({ row }) => (
          <span className="font-medium text-green-700 dark:text-green-400">
            {row.original.quantity - row.original.reservedQuantity}
          </span>
        )
      }
    ],
    [categoriesById]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" disabled>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Warehouses
        </Button>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/warehouses')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Warehouses
        </Button>
        <div className="rounded-xl border border-border bg-card p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="mb-4 h-8 w-8 text-destructive" />
            <p className="text-muted-foreground">Warehouse not found</p>
          </div>
        </div>
      </div>
    );
  }

  const stockItems = stockPages?.pages.flatMap((page) => page.stock) || [];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/warehouses')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Warehouses
      </Button>

      {/* Header Info */}
      <div className="space-y-4">
        <div>
          <h1 className="break-words text-3xl font-bold text-foreground">{warehouse.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {warehouse.code}
            </span>
            {warehouse.isDefault && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Default warehouse
              </span>
            )}
            {warehouse.isActive ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">Active</span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Inactive</span>
            )}
          </div>
        </div>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-foreground">Warehouse Details</h2>
                {warehouse.description && <p className="mt-2 text-sm text-muted-foreground">{warehouse.description}</p>}
                
                {/* Address */}
                {Object.values(warehouse.address || {}).some(Boolean) && (
                  <div className="mt-3 space-y-0.5 text-sm text-muted-foreground">
                    {warehouse.address.street && <p>{warehouse.address.street}</p>}
                    {(warehouse.address.city || warehouse.address.state) && (
                      <p>{[warehouse.address.city, warehouse.address.state].filter(Boolean).join(', ')}</p>
                    )}
                    {(warehouse.address.country || warehouse.address.postalCode) && (
                      <p>{[warehouse.address.country, warehouse.address.postalCode].filter(Boolean).join(' ')}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Stats Cards */}
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:ml-4 sm:grid-cols-1">
                <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/20">
                  <p className="text-xs text-blue-600 dark:text-blue-300">Products</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                    {warehouse.stockSummary?.totalProducts ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/20">
                  <p className="text-xs text-green-600 dark:text-green-300">Units</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                    {warehouse.stockSummary?.totalUnits ?? 0}
                  </p>
                </div>
              </div>
            </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <PermissionGuard permission="warehouse.manage" fallback={null}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormModal(true)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>

              {!warehouse.isDefault && warehouse.isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={setDefaultMutation.isPending}
                  onClick={() => setDefaultMutation.mutate({ id: warehouse._id, name: warehouse.name })}
                  className="gap-2"
                >
                  <Star className="h-4 w-4" />
                  Set as default
                </Button>
              )}

              {warehouse.isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeactivateDialog(true)}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <EyeOff className="h-4 w-4" />
                  Deactivate
                </Button>
              )}
            </PermissionGuard>
          </div>
        </section>
      </div>

      {/* Stock Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Stock in this warehouse</h2>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search products..."
            aria-label="Search products in this warehouse"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-md"
          />
          <Button
            variant={showLowStockOnly ? 'default' : 'outline'}
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            size="sm"
            aria-pressed={showLowStockOnly}
          >
            Low stock only
          </Button>
        </div>

        {/* Stock Table */}
        {!isStockLoading && stockItems.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center py-12">
              {showLowStockOnly ? (
                <>
                  <div className="mb-2 text-3xl">✓</div>
                  <p className="text-muted-foreground">No low stock items</p>
                </>
              ) : (
                <p className="text-muted-foreground">No stock in this warehouse</p>
              )}
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={stockItems}
            isLoading={isStockLoading}
            hiddenColumnIds={isMobile ? ['category', 'unit', 'reserved'] : []}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={!!hasNextPage}
            onFetchNextPage={() => {
              void fetchNextPage();
            }}
            onRowClick={(item) => {
              if (item.product?._id) navigate(`/products/${item.product._id}`);
            }}
            emptyMessage={showLowStockOnly ? 'No low stock items' : 'No stock in this warehouse'}
          />
        )}
      </div>

      {/* Modals */}
      <WarehouseFormModal
        mode="edit"
        warehouse={warehouse}
        open={formModal}
        onClose={() => setFormModal(false)}
      />

      <ConfirmDeactivateWarehouseDialog
        warehouse={warehouse}
        open={deactivateDialog}
        onClose={() => setDeactivateDialog(false)}
      />
    </div>
  );
}
