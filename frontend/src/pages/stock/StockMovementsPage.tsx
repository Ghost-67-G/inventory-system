import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Filter, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { useWindowSize } from '@/hooks/useWindowSize';
import { WarehouseBadge } from '@/components/shared/WarehouseBadge';
import { useMovements } from '@/hooks/useStock';
import { useWarehousesDropdown } from '@/hooks/useWarehouses';
import type { IStockMovement } from '@/types';
import { RecordMovementDrawer } from '@/components/stock/RecordMovementDrawer';
import { MovementDetailDrawer } from '@/components/stock/MovementDetailDrawer';

export function StockMovementsPage() {
  const [productId, setProductId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [recordOpen, setRecordOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const { isMobile, isTablet } = useWindowSize();

  const movementsQuery = useMovements({
    productId: productId || undefined,
    warehouseId: warehouseId || undefined,
    type:
      typeFilter && typeFilter !== 'TRANSFER'
        ? (typeFilter as 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE' | 'TRANSFER_OUT' | 'TRANSFER_IN')
        : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });

  const { data: warehouses = [] } = useWarehousesDropdown();

  const movements = useMemo(() => {
    const flat = movementsQuery.data?.pages.flatMap((page) => page.movements) ?? [];
    if (typeFilter === 'TRANSFER') {
      return flat.filter((item) => item.type === 'TRANSFER_IN' || item.type === 'TRANSFER_OUT');
    }
    return flat;
  }, [movementsQuery.data?.pages, typeFilter]);

  const columns = useMemo<ColumnDef<IStockMovement>[]>(
    () => [
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const movement = row.original;
          const labelMap: Record<string, string> = {
            IN: 'In',
            OUT: 'Out',
            ADJUSTMENT: 'Adjust',
            WASTE: 'Waste',
            TRANSFER_IN: 'Transfer in',
            TRANSFER_OUT: 'Transfer out'
          };
          const colorMap: Record<string, string> = {
            IN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            OUT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            ADJUSTMENT: movement.quantity >= 0
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            WASTE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
            TRANSFER_IN: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
            TRANSFER_OUT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
          };
          return (
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${colorMap[movement.type]}`}>
              {labelMap[movement.type]}
            </span>
          );
        }
      },
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.product?.name ?? '-'}</div>
            <div className="text-xs text-muted-foreground">{row.original.product?.sku ?? '-'}</div>
          </div>
        )
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: ({ row }) =>
          row.original.warehouse ? (
            <WarehouseBadge code={row.original.warehouse.code} name={row.original.warehouse.name} size="sm" />
          ) : (
            '-'
          )
      },
      {
        id: 'quantity',
        header: 'Quantity',
        cell: ({ row }) => {
          const movement = row.original;
          const unit = movement.product?.unit ?? '';
          const display =
            movement.type === 'IN' || movement.type === 'TRANSFER_IN'
              ? `+${movement.quantity}`
              : movement.type === 'ADJUSTMENT'
                ? `${movement.quantity}`
                : `-${movement.quantity}`;
          const tone =
            movement.type === 'IN' || movement.type === 'TRANSFER_IN'
              ? 'text-emerald-700 dark:text-emerald-400'
              : movement.type === 'ADJUSTMENT' && movement.quantity > 0
                ? 'text-blue-700 dark:text-blue-400'
                : movement.type === 'ADJUSTMENT' && movement.quantity < 0
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-red-700 dark:text-red-400';
          return <span className={`font-semibold ${tone}`}>{display} {unit}</span>;
        }
      },
      {
        id: 'stockAfter',
        header: 'Stock after',
        cell: ({ row }) => `${row.original.quantityAfter} ${row.original.product?.unit ?? ''}`
      },
      {
        id: 'performedBy',
        header: 'Performed by',
        cell: ({ row }) => row.original.performedByUser?.name ?? '-'
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => format(new Date(row.original.createdAt), 'MMM dd, yyyy HH:mm')
      },
      {
        id: 'note',
        header: 'Note',
        cell: ({ row }) => (
          <span title={row.original.note} className="line-clamp-1 max-w-65 text-muted-foreground">
            {row.original.note || '-'}
          </span>
        )
      }
    ],
    []
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Stock movements" subtitle="Complete audit trail of all stock changes">
        <Button onClick={() => setRecordOpen(true)} className="hidden md:inline-flex">
          <Plus className="mr-2 h-4 w-4" />
          Record movement
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 md:hidden">
          <Button variant="outline" className="h-11 min-h-11" onClick={() => setShowFilters((value) => !value)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>

        <div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-1 gap-3 md:grid md:grid-cols-5`}>
          <Input
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="Filter by productId"
            className="h-11 md:h-9"
          />
          <select
            className="h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse._id} value={warehouse._id}>{warehouse.code} - {warehouse.name}</option>
            ))}
          </select>
          <select
            className="h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
            <option value="WASTE">WASTE</option>
            <option value="TRANSFER">TRANSFER</option>
          </select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 md:h-9" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 md:h-9" />
        </div>

        {(productId || warehouseId || typeFilter || dateFrom || dateTo) && (
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => {
                setProductId('');
                setWarehouseId('');
                setTypeFilter('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <DataTable<IStockMovement>
        columns={columns}
        data={movements}
        isLoading={movementsQuery.isLoading}
        isFetchingNextPage={movementsQuery.isFetchingNextPage}
        hasNextPage={movementsQuery.hasNextPage}
        onFetchNextPage={() => void movementsQuery.fetchNextPage()}
        emptyMessage={
          productId || warehouseId || typeFilter || dateFrom || dateTo
            ? 'No movements match your filters'
            : 'No movements recorded yet'
        }
        getRowId={(row) => row._id}
        onRowClick={(row) => {
          setSelectedMovementId(row._id);
          setDetailOpen(true);
        }}
        hiddenColumnIds={isMobile ? ['warehouse', 'stockAfter', 'performedBy', 'date', 'note'] : isTablet ? ['note', 'performedBy'] : []}
        maxHeight={isMobile ? 'calc(100dvh - 180px)' : 'calc(100dvh - 280px)'}
      />

      <FloatingActionButton
        onClick={() => setRecordOpen(true)}
        icon={Plus}
        label="Record movement"
        permission="stock.adjust"
      />

      <RecordMovementDrawer open={recordOpen} onClose={() => setRecordOpen(false)} type="in" />
      <MovementDetailDrawer movementId={selectedMovementId} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
