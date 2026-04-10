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
import type { IPurchaseOrder, POStatus } from '@/types';

const statusFilters: Array<{ label: string; value: POStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
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
  const statsQuery = usePOStats();
  const suppliersQuery = useSuppliersDropdown();
  const warehousesQuery = useWarehousesDropdown();

  const [status, setStatus] = useState<POStatus | 'ALL'>(() => {
    const initial = searchParams.get('status');
    return initial === 'OPEN' ? 'ALL' : ((initial as POStatus | null) ?? 'ALL');
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

  const ordersQuery = usePurchaseOrders({
    status: searchParams.get('status') === 'OPEN' ? 'OPEN' : status === 'ALL' ? undefined : status,
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
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.poNumber}</span>
      },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: ({ row }) => row.original.supplierName
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: ({ row }) => row.original.warehouseName
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <POStatusBadge status={row.original.status} size="sm" />
      },
      {
        id: 'items',
        header: 'Items',
        cell: ({ row }) => `${row.original.lineItems.length} items`
      },
      {
        id: 'total',
        header: 'Total',
        cell: ({ row }) => formatMoney(row.original.totalAmount)
      },
      {
        id: 'expected',
        header: 'Expected delivery',
        cell: ({ row }) => (row.original.expectedDeliveryDate ? formatDate(row.original.expectedDeliveryDate) : '—')
      },
      {
        id: 'created',
        header: 'Created',
        cell: ({ row }) => formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {row.original.status === 'DRAFT' ? (
              <>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => { setEditingOrder(row.original); setFormOpen(true); }}>Edit</button>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => void sendMutation.mutateAsync({ id: row.original._id, sendEmail: true })}>Send</button>
                <button className="text-xs text-red-600 hover:underline" onClick={() => void cancelMutation.mutateAsync({ id: row.original._id })}>Cancel</button>
              </>
            ) : null}
            {(row.original.status === 'SENT' || row.original.status === 'PARTIAL') ? (
              <>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => setReceivingOrder(row.original)}>Receive</button>
                {row.original.status === 'SENT' ? (
                  <button className="text-xs text-red-600 hover:underline" onClick={() => void cancelMutation.mutateAsync({ id: row.original._id })}>Cancel</button>
                ) : null}
              </>
            ) : null}
            {(row.original.status === 'RECEIVED' || row.original.status === 'CANCELLED') ? (
              <button className="text-xs text-blue-600 hover:underline" onClick={() => navigate(`/purchase-orders/${row.original._id}`)}>View</button>
            ) : null}
          </div>
        )
      }
    ],
    [cancelMutation, formatDate, formatMoney, navigate, sendMutation]
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
        <button className="rounded-xl border border-border bg-card p-3 text-left" onClick={() => setStatus('ALL')}>
          <p className="text-xs text-muted-foreground">Pending orders</p>
          <p className="text-xl font-semibold">{statsQuery.data?.totalPending ?? 0}</p>
        </button>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pending value</p>
          <p className="text-xl font-semibold">{formatMoney(statsQuery.data?.pendingValue ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Received this month</p>
          <p className="text-xl font-semibold">{formatMoney(statsQuery.data?.thisMonthValue ?? 0)}</p>
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
              className={`rounded-full px-3 py-1 text-sm ${status === item.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setStatus(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">All suppliers</option>
            {suppliersQuery.data?.map((supplier) => (
              <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
            ))}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">All warehouses</option>
            {warehousesQuery.data?.map((warehouse) => (
              <option key={warehouse._id} value={warehouse._id}>{warehouse.name}</option>
            ))}
          </select>
          <InputDate value={dateFrom} onChange={setDateFrom} placeholder="From" />
          <InputDate value={dateTo} onChange={setDateTo} placeholder="To" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        isLoading={ordersQuery.isLoading}
        hasNextPage={ordersQuery.hasNextPage}
        isFetchingNextPage={ordersQuery.isFetchingNextPage}
        onFetchNextPage={() => void ordersQuery.fetchNextPage()}
        onRowClick={(order) => navigate(`/purchase-orders/${order._id}`)}
        emptyMessage="No purchase orders found"
      />

      <POFormDrawer open={formOpen} onClose={() => setFormOpen(false)} order={editingOrder} prefillProductId={prefillProductId} />
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
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
