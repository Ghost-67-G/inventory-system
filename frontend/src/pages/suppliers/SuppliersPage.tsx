import { useMemo, useState } from 'react';
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

export function SuppliersPage() {
  const navigate = useNavigate();
  const { formatMoney } = useTenantFormatting();
  const deactivateMutation = useDeactivateSupplier();

  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<'true' | 'false' | 'all'>('true');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<ISupplier | undefined>();

  const suppliersQuery = useSuppliers({
    search: search || undefined,
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
          <div>
            <span className="inline-flex rounded bg-muted px-2 py-0.5 font-mono text-xs">{row.original.code}</span>
            <p className="mt-1 font-medium">{row.original.name}</p>
          </div>
        )
      },
      {
        id: 'contact',
        header: 'Contact',
        size: 220,
        cell: ({ row }) => (
          <div>
            <p>{row.original.contactName || '-'}</p>
            <p className="text-xs text-muted-foreground">{row.original.email || '-'}</p>
          </div>
        )
      },
      {
        id: 'terms',
        header: 'Payment terms',
        cell: ({ row }) => <span className="text-sm">{row.original.paymentTerms}</span>
      },
      {
        id: 'leadTime',
        header: 'Lead time',
        cell: ({ row }) => <span className="text-sm">{row.original.leadTimeDays} days</span>
      },
      {
        id: 'totalOrders',
        header: 'Total orders',
        cell: ({ row }) => row.original.totalOrders
      },
      {
        id: 'totalOrderValue',
        header: 'Total value',
        cell: ({ row }) => formatMoney(row.original.totalOrderValue)
      },
      {
        id: 'lastOrder',
        header: 'Last order',
        cell: ({ row }) =>
          row.original.lastOrderDate
            ? formatDistanceToNow(new Date(row.original.lastOrderDate), { addSuffix: true })
            : 'Never'
      },
      {
        id: 'status',
        header: 'Status',
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
        cell: ({ row }) => (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <PermissionGuard permission="supplier.manage">
              <button
                className="text-xs text-blue-600 hover:underline"
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
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => void deactivateMutation.mutateAsync(row.original._id)}
                >
                  Deactivate
                </button>
              </PermissionGuard>
            ) : null}
          </div>
        )
      }
    ],
    [deactivateMutation, formatMoney]
  );

  return (
    <div>
      <PageHeader title="Suppliers" subtitle={`${suppliers.length} active suppliers`}>
        <PermissionGuard permission="supplier.manage">
          <Button onClick={() => { setEditSupplier(undefined); setDrawerOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" />
            Add supplier
          </Button>
        </PermissionGuard>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
            placeholder="Search suppliers"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
