import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit, EyeOff, RotateCcw, Star } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WarehouseFormModal } from '@/components/warehouses/WarehouseFormModal';
import { ConfirmDeactivateWarehouseDialog } from '@/components/warehouses/ConfirmDeactivateWarehouseDialog';
import {
  useReactivateWarehouse,
  useSetDefaultWarehouse,
  useWarehouses,
  useWarehouseSummary
} from '@/hooks/useWarehouses';
import type { IWarehouse } from '@/types';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function WarehousesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [formModal, setFormModal] = useState<{ open: boolean; mode: 'create' | 'edit'; warehouse?: IWarehouse }>({
    open: false,
    mode: 'create'
  });
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; warehouse?: IWarehouse }>({
    open: false
  });
  const debouncedSearch = useDebounce(search, 300);

  const { data: warehouses = [] } = useWarehouses({
    isActive: statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : undefined,
    search: debouncedSearch || undefined
  });

  const { data: summary } = useWarehouseSummary();
  const setDefaultMutation = useSetDefaultWarehouse();
  const reactivateMutation = useReactivateWarehouse();

  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((w) => {
      if (statusFilter === 'active') return w.isActive;
      if (statusFilter === 'inactive') return !w.isActive;
      return true;
    });
  }, [warehouses, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <PageHeader
            title="Warehouses"
            subtitle={
              summary
                ? `${summary.active} of ${summary.total} warehouses active`
                : 'Manage storage locations'
            }
          />
        </div>
        <PermissionGuard permission="warehouse.manage" fallback={null}>
          <Button
            onClick={() => setFormModal({ open: true, mode: 'create' })}
          >
            Add warehouse
          </Button>
        </PermissionGuard>
      </div>

      {/* Summary Strip */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Total warehouses</p>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">{summary.total}</div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Active warehouses</p>
            <div className="mt-2">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.active}</div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Total products</p>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">{summary.totalProducts}</div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Units in stock</p>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">{summary.totalUnits}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="space-y-4">
        <Input
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        <div className="flex gap-2">
          {(['active', 'inactive', 'all'] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Warehouse Cards Grid */}
      {filteredWarehouses.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-muted-foreground">No warehouses found</p>
            <PermissionGuard permission="warehouse.manage" fallback={null}>
              <Button
                variant="outline"
                onClick={() => setFormModal({ open: true, mode: 'create' })}
              >
                Add your first warehouse
              </Button>
            </PermissionGuard>
          </div>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}
        >
          {filteredWarehouses.map((warehouse) => (
            <article
              key={warehouse._id}
              className={`flex flex-col rounded-xl border border-border bg-card shadow-sm ${!warehouse.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between border-b border-border p-4">
                  <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground">{warehouse.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        {warehouse.code}
                    </span>
                    {warehouse.isDefault && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Default
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${warehouse.isActive ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${warehouse.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`}
                      />
                      {warehouse.isActive ? 'Active' : 'Inactive'}
                    </span>
                    </div>
                  </div>
                  <PermissionGuard permission="warehouse.manage" fallback={null}>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormModal({ open: true, mode: 'edit', warehouse })}
                    >
                      <Edit className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {!warehouse.isDefault && warehouse.isActive && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate({ id: warehouse._id, name: warehouse.name })}
                      >
                        <Star className="mr-1 h-3.5 w-3.5" />
                        Set default
                      </Button>
                    )}
                    {warehouse.isActive ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeactivateDialog({ open: true, warehouse })}
                      >
                        <EyeOff className="mr-1 h-3.5 w-3.5" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => reactivateMutation.mutate(warehouse._id)}
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        Reactivate
                      </Button>
                    )}
                  </div>
                  </PermissionGuard>
                </div>

              <div className="flex-1 space-y-4 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">Products</p>
                    <p className="text-lg font-semibold text-foreground">{warehouse.stockSummary.totalProducts}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">Units</p>
                    <p className="text-lg font-semibold text-foreground">{warehouse.stockSummary.totalUnits}</p>
                  </div>
                </div>

                {/* Address */}
                {Object.values(warehouse.address || {}).some(Boolean) && (
                  <div className="text-xs text-muted-foreground">
                    {warehouse.address?.city && warehouse.address?.country
                      ? `${warehouse.address.city}, ${warehouse.address.country}`
                      : Object.values(warehouse.address || {})
                          .filter(Boolean)
                          .join(', ')}
                  </div>
                )}

                {warehouse.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{warehouse.description}</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border p-4">
                <Link
                  to={`/warehouses/${warehouse._id}`}
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  View stock →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modals */}
      <WarehouseFormModal
        mode={formModal.mode}
        warehouse={formModal.warehouse}
        open={formModal.open}
        onClose={() => setFormModal({ open: false, mode: 'create' })}
      />

      {deactivateDialog.warehouse && (
        <ConfirmDeactivateWarehouseDialog
          warehouse={deactivateDialog.warehouse}
          open={deactivateDialog.open}
          onClose={() => setDeactivateDialog({ open: false })}
        />
      )}
    </div>
  );
}

