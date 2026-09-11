import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import { SupplierFormDrawer } from '@/components/suppliers/SupplierFormDrawer';
import { useSuppliers, useDeactivateSupplier } from '@/hooks/useSuppliers';
import { useTenantFormatting } from '@/hooks/useTenantFormatting';
import type { ISupplier } from '@/types';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function SuppliersPage() {
  const navigate = useNavigate();
  const { formatMoney } = useTenantFormatting();
  const deactivateMutation = useDeactivateSupplier();

  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<'true' | 'false' | 'all'>('true');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<ISupplier | undefined>();
  const debouncedSearch = useDebounce(search, 300);

  const suppliersQuery = useSuppliers({
    search: debouncedSearch || undefined,
    isActive: isActive === 'all' ? undefined : isActive
  });

  const suppliers = useMemo(() => suppliersQuery.data?.pages.flatMap((page) => page.suppliers) ?? [], [suppliersQuery.data]);

  const columns = useMemo<ColumnDef<ISupplier>[]>(
    () => [
      {
        id: 'supplier',
        header: 'Supplier',
        size: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="inline-flex rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{row.original.code}</span>
            <p className="mt-1 truncate font-medium text-foreground" title={row.original.name}>{row.original.name}</p>
          </div>
        )
      },
      {
        id: 'contact',
        header: 'Contact',
        size: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{row.original.contactName || '-'}</p>
            <p className="truncate text-xs text-muted-foreground" title={row.original.email || undefined}>{row.original.email || '-'}</p>
          </div>
        )
      },
      {
        id: 'terms',
        header: 'Payment terms',
        size: 130,
        cell: ({ row }) => <span className="text-sm">{row.original.paymentTerms}</span>
      },
      {
        id: 'leadTime',
        header: 'Lead time',
        size: 110,
        cell: ({ row }) => <span className="text-sm">{row.original.leadTimeDays} days</span>
      },
      {
        id: 'totalOrders',
        header: 'Total orders',
        size: 120,
        cell: ({ row }) => row.original.totalOrders
      },
      {
        id: 'totalOrderValue',
        header: 'Total value',
        size: 140,
        cell: ({ row }) => formatMoney(row.original.totalOrderValue)
      },
      {
        id: 'lastOrder',
        header: 'Last order',
        size: 150,
        cell: ({ row }) =>
          row.original.lastOrderDate
            ? formatDistanceToNow(new Date(row.original.lastOrderDate), { addSuffix: true })
            : 'Never'
      },
      {
        id: 'status',
        header: 'Status',
        size: 100,
        cell: ({ row }) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
              row.original.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {row.original.isActive ? 'Active' : 'Inactive'}
          </span>
        )
      },
      {
        id: 'actions',
        header: '',
        size: 140,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <PermissionGuard permission="supplier.manage">
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                onClick={() => {
                  setEditSupplier(row.original);
                  setDrawerOpen(true);
                }}
              >
                Edit
              </button>
            </PermissionGuard>
            {row.original.isActive ? (
              <PermissionGuard permission="supplier.manage">
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  disabled={deactivateMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Deactivate supplier "${row.original.name}"?`)) {
                      void deactivateMutation.mutateAsync(row.original._id).catch(() => undefined);
                    }
                  }}
                >
                  Deactivate
                </button>
              </PermissionGuard>
            ) : null}
          </div>
        )
      }
    ],
    [deactivateMutation.mutateAsync, deactivateMutation.isPending, formatMoney]
  );

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length}${suppliersQuery.hasNextPage ? '+' : ''} ${
          isActive === 'true' ? 'active ' : isActive === 'false' ? 'inactive ' : ''
        }supplier${suppliers.length === 1 ? '' : 's'}`}
      >
        <PermissionGuard permission="supplier.manage">
          <Button type="button" onClick={() => { setEditSupplier(undefined); setDrawerOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" />
            Add supplier
          </Button>
        </PermissionGuard>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Search suppliers"
            aria-label="Search suppliers"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Filter suppliers by status"
          value={isActive}
          onChange={(e) => setIsActive(e.target.value as 'true' | 'false' | 'all')}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={suppliers}
        isLoading={suppliersQuery.isLoading}
        hasNextPage={suppliersQuery.hasNextPage}
        isFetchingNextPage={suppliersQuery.isFetchingNextPage}
        onFetchNextPage={() => void suppliersQuery.fetchNextPage()}
        onRowClick={(supplier) => navigate(`/suppliers/${supplier._id}`)}
        emptyMessage="No suppliers yet - add your first supplier"
      />

      <SupplierFormDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} supplier={editSupplier} />
    </div>
  );
}
