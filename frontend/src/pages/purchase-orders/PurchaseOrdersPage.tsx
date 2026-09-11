import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import { POStatusBadge } from '@/components/purchase-orders/POStatusBadge';
import { POFormDrawer } from '@/components/purchase-orders/POFormDrawer';
import { ReceiveItemsDrawer } from '@/components/purchase-orders/ReceiveItemsDrawer';
import { useCancelPO, usePOStats, usePurchaseOrders, useSendPO } from '@/hooks/usePurchaseOrders';
import { useSuppliersDropdown } from '@/hooks/useSuppliers';
import { useWarehousesDropdown } from '@/hooks/useWarehouses';
import { useTenantFormatting } from '@/hooks/useTenantFormatting';
import { usePermission } from '@/hooks/usePermission';
import { useWindowSize } from '@/hooks/useWindowSize';
import type { IPurchaseOrder, POStatus } from '@/types';

type StatusFilter = POStatus | 'ALL' | 'OPEN';

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Cancelled', value: 'CANCELLED' }
];

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { formatMoney, formatDate } = useTenantFormatting();
  const { canDo } = usePermission();
  const { isMobile, isTablet } = useWindowSize();
  const statsQuery = usePOStats();
  const suppliersQuery = useSuppliersDropdown();
  const warehousesQuery = useWarehousesDropdown();

  const [status, setStatus] = useState<StatusFilter>(() => {
    const initial = searchParams.get('status');
    // Only accept known filter values from the URL; anything else falls back to ALL.
    return statusFilters.some((item) => item.value === initial) ? (initial as StatusFilter) : 'ALL';
  });
  const [supplierId, setSupplierId] = useState(() => searchParams.get('supplierId') ?? '');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formOpen, setFormOpen] = useState(() => Boolean(searchParams.get('productId')));
  const [prefillProductId] = useState(() => searchParams.get('productId') ?? undefined);
  const [editingOrder, setEditingOrder] = useState<IPurchaseOrder | undefined>();
  const [receivingOrder, setReceivingOrder] = useState<IPurchaseOrder | undefined>();

  const sendMutation = useSendPO();
  const cancelMutation = useCancelPO();

  const canUpdate = canDo('po.update');
  const canReceive = canDo('po.receive');
  const actionsPending = sendMutation.isPending || cancelMutation.isPending;

  const ordersQuery = usePurchaseOrders({
    status: status === 'ALL' ? undefined : status,
    supplierId: supplierId || undefined,
    warehouseId: warehouseId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });

  const orders = useMemo(() => ordersQuery.data?.pages.flatMap((page) => page.orders) ?? [], [ordersQuery.data]);

  const columns = useMemo<ColumnDef<IPurchaseOrder>[]>(
    () => [
      {
        id: 'poNumber',
        header: 'PO number',
        size: 140,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.poNumber}</span>
      },
      {
        id: 'supplier',
        header: 'Supplier',
        size: 180,
        cell: ({ row }) => <span className="block truncate" title={row.original.supplierName}>{row.original.supplierName || '—'}</span>
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        size: 160,
        cell: ({ row }) => <span className="block truncate" title={row.original.warehouseName}>{row.original.warehouseName || '—'}</span>
      },
      {
        id: 'status',
        header: 'Status',
        size: 110,
        cell: ({ row }) => <POStatusBadge status={row.original.status} size="sm" />
      },
      {
        id: 'items',
        header: 'Items',
        size: 90,
        cell: ({ row }) => `${row.original.lineItems?.length ?? 0} items`
      },
      {
        id: 'total',
        header: 'Total',
        size: 120,
        cell: ({ row }) => formatMoney(row.original.totalAmount)
      },
      {
        id: 'expected',
        header: 'Expected delivery',
        size: 150,
        cell: ({ row }) => (row.original.expectedDeliveryDate ? formatDate(row.original.expectedDeliveryDate) : '—')
      },
      {
        id: 'created',
        header: 'Created',
        size: 140,
        cell: ({ row }) => formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 170,
        enableSorting: false,
        cell: ({ row }) => {
          const order = row.original;
          const confirmCancel = () => {
            if (window.confirm(`Cancel purchase order ${order.poNumber}?`)) {
              cancelMutation.mutate({ id: order._id });
            }
          };
          const linkClass = 'text-xs text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400';
          const dangerClass = 'text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400';
          return (
            <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              {order.status === 'DRAFT' && canUpdate ? (
                <>
                  <button type="button" className={linkClass} onClick={() => { setEditingOrder(order); setFormOpen(true); }}>Edit</button>
                  <button type="button" className={linkClass} disabled={actionsPending} onClick={() => sendMutation.mutate({ id: order._id, sendEmail: true })}>Send</button>
                  <button type="button" className={dangerClass} disabled={actionsPending} onClick={confirmCancel}>Cancel</button>
                </>
              ) : null}
              {(order.status === 'SENT' || order.status === 'PARTIAL') ? (
                <>
                  {canReceive ? (
                    <button type="button" className={linkClass} onClick={() => setReceivingOrder(order)}>Receive</button>
                  ) : null}
                  {order.status === 'SENT' && canUpdate ? (
                    <button type="button" className={dangerClass} disabled={actionsPending} onClick={confirmCancel}>Cancel</button>
                  ) : null}
                </>
              ) : null}
              {(order.status === 'RECEIVED' || order.status === 'CANCELLED') ? (
                <button type="button" className={linkClass} onClick={() => navigate(`/purchase-orders/${order._id}`)}>View</button>
              ) : null}
            </div>
          );
        }
      }
    ],
    [actionsPending, canReceive, canUpdate, cancelMutation, formatDate, formatMoney, navigate, sendMutation]
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Purchase orders">
        <PermissionGuard permission="po.create">
          <Button onClick={() => { setEditingOrder(undefined); setFormOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" />
            New purchase order
          </Button>
        </PermissionGuard>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button type="button" className="min-w-0 rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/50" onClick={() => setStatus('OPEN')}>
          <p className="text-xs text-muted-foreground">Pending orders</p>
          <p className="text-xl font-semibold">{statsQuery.data?.totalPending ?? 0}</p>
        </button>
        <div className="min-w-0 rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pending value</p>
          <p className="truncate text-xl font-semibold" title={formatMoney(statsQuery.data?.pendingValue ?? 0)}>{formatMoney(statsQuery.data?.pendingValue ?? 0)}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Received this month</p>
          <p className="truncate text-xl font-semibold" title={formatMoney(statsQuery.data?.thisMonthValue ?? 0)}>{formatMoney(statsQuery.data?.thisMonthValue ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total received</p>
          <p className="text-xl font-semibold">{statsQuery.data?.totalReceived ?? 0}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={status === item.value}
              className={`rounded-full px-3 py-1 text-sm ${status === item.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              onClick={() => setStatus(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <select className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground" aria-label="Filter by supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">All suppliers</option>
            {suppliersQuery.data?.map((supplier) => (
              <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
            ))}
          </select>
          <select className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground" aria-label="Filter by warehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">All warehouses</option>
            {warehousesQuery.data?.map((warehouse) => (
              <option key={warehouse._id} value={warehouse._id}>{warehouse.name}</option>
            ))}
          </select>
          <InputDate value={dateFrom} onChange={setDateFrom} placeholder="From date" />
          <InputDate value={dateTo} onChange={setDateTo} placeholder="To date" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        isLoading={ordersQuery.isLoading}
        hasNextPage={ordersQuery.hasNextPage}
        isFetchingNextPage={ordersQuery.isFetchingNextPage}
        onFetchNextPage={() => void ordersQuery.fetchNextPage()}
        getRowId={(order) => order._id}
        onRowClick={(order) => navigate(`/purchase-orders/${order._id}`)}
        emptyMessage="No purchase orders found"
        hiddenColumnIds={isMobile ? ['warehouse', 'items', 'expected', 'created'] : isTablet ? ['items', 'created'] : []}
      />

      <POFormDrawer open={formOpen} onClose={() => { setFormOpen(false); setEditingOrder(undefined); }} order={editingOrder} prefillProductId={prefillProductId} />
      {receivingOrder ? (
        <ReceiveItemsDrawer open={Boolean(receivingOrder)} onClose={() => setReceivingOrder(undefined)} order={receivingOrder} />
      ) : null}
    </div>
  );
}

function InputDate({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input
      type="date"
      className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground"
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
