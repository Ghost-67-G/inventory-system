import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POStatusBadge } from '@/components/purchase-orders/POStatusBadge';
import { POFormDrawer } from '@/components/purchase-orders/POFormDrawer';
import { ReceiveItemsDrawer } from '@/components/purchase-orders/ReceiveItemsDrawer';
import { useCancelPO, usePurchaseOrder, useSendPO } from '@/hooks/usePurchaseOrders';
import { useMovements } from '@/hooks/useStock';
import { useTenantFormatting } from '@/hooks/useTenantFormatting';
import { usePermission } from '@/hooks/usePermission';
import type { IStockMovement } from '@/types';

export function PurchaseOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { formatDate, formatMoney } = useTenantFormatting();
  const { canDo } = usePermission();

  const orderQuery = usePurchaseOrder(id);
  const sendMutation = useSendPO();
  const cancelMutation = useCancelPO();

  const [editOpen, setEditOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const order = orderQuery.data;
  // Receipts are recorded with the PO id as referenceId, so the API returns exactly this order's movements.
  const movementsQuery = useMovements({ referenceId: id });

  const movements = useMemo(
    () => (movementsQuery.data?.pages.flatMap((page) => page.movements) ?? []) as IStockMovement[],
    [movementsQuery.data]
  );

  const actionsPending = sendMutation.isPending || cancelMutation.isPending;
  const confirmCancel = () => {
    if (order && window.confirm(`Cancel purchase order ${order.poNumber}?`)) {
      cancelMutation.mutate({ id: order._id });
    }
  };

  if (orderQuery.isError || (!orderQuery.isLoading && !order)) {
    return (
      <div className="space-y-4">
        <button type="button" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/purchase-orders')}>
          <ArrowLeft className="h-4 w-4" />
          Purchase orders
        </button>
        <p className="text-sm text-destructive">Purchase order not found or failed to load.</p>
      </div>
    );
  }

  if (!order) {
    return <div className="text-sm text-muted-foreground">Loading purchase order...</div>;
  }

  return (
    <div className="space-y-6">
      <button type="button" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/purchase-orders')}>
        <ArrowLeft className="h-4 w-4" />
        Purchase orders
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">{order.poNumber}</h1>
          <div className="mt-2"><POStatusBadge status={order.status} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === 'DRAFT' && canDo('po.update') ? (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
              <Button disabled={actionsPending} onClick={() => sendMutation.mutate({ id: order._id, sendEmail: true })}>Send to supplier</Button>
              <Button variant="destructive" disabled={actionsPending} onClick={confirmCancel}>Cancel</Button>
            </>
          ) : null}
          {(order.status === 'SENT' || order.status === 'PARTIAL') ? (
            <>
              {canDo('po.receive') ? <Button onClick={() => setReceiveOpen(true)}>Receive items</Button> : null}
              {order.status === 'SENT' && canDo('po.update') ? (
                <Button variant="destructive" disabled={actionsPending} onClick={confirmCancel}>Cancel</Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {order.status === 'CANCELLED' && order.notes?.includes('Stock already received is retained') ? (
        <div className="rounded-lg border border-amber-200 bg-amber-100 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Stock already received was not reversed when this partially received order was cancelled.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 font-semibold">Line items</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Product</th>
                    <th className="pr-3">SKU</th>
                    <th className="pr-3">Ordered</th>
                    <th className="pr-3">Received</th>
                    <th className="pr-3">Remaining</th>
                    <th className="pr-3">Unit cost</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.lineItems ?? []).map((item, index) => {
                    const remaining = item.orderedQty - item.receivedQty;
                    const rowClass = remaining === 0 ? 'bg-green-50/60 dark:bg-green-900/10' : item.receivedQty > 0 ? 'bg-amber-50/60 dark:bg-amber-900/10' : '';
                    return (
                      <tr key={`${item.productId}-${index}`} className={`border-b border-border ${rowClass}`}>
                        <td className="py-2 pr-3">{item.productName}</td>
                        <td className="pr-3 font-mono text-xs">{item.productSku}</td>
                        <td className="pr-3">{item.orderedQty} {item.unit}</td>
                        <td className="pr-3">{item.receivedQty}</td>
                        <td className="pr-3">{remaining}</td>
                        <td className="pr-3">{formatMoney(item.unitCost)}</td>
                        <td>{formatMoney(item.totalCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
              <div className="flex justify-between"><span>Tax ({order.taxRate}%)</span><span>{formatMoney(order.taxAmount)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{formatMoney(order.shippingCost)}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total</span><span>{formatMoney(order.totalAmount)}</span></div>
            </div>
          </div>

          {order.notes || order.supplierReference ? (
            <div className="rounded-xl border border-border bg-card p-4">
              {order.notes ? <p className="whitespace-pre-wrap break-words text-sm"><strong>Notes:</strong> {order.notes}</p> : null}
              {order.supplierReference ? <p className="mt-2 break-words text-sm"><strong>Supplier ref:</strong> {order.supplierReference}</p> : null}
            </div>
          ) : null}

          {(order.status === 'PARTIAL' || order.status === 'RECEIVED') ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 font-semibold">Stock movements</h3>
              <div className="space-y-2">
                {movementsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading movements...</p> : null}
                {!movementsQuery.isLoading && movements.length === 0 ? <p className="text-sm text-muted-foreground">No movements found</p> : null}
                {movements.map((movement) => (
                  <div key={movement._id} className="rounded border border-border p-2 text-sm">
                    <p>{movement.product?.name ?? movement.productId}</p>
                    <p className="text-xs text-muted-foreground">
                      +{movement.quantity} on {formatDate(movement.createdAt)} by {movement.performedByUser?.name ?? 'User'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 font-semibold">PO details</h3>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Supplier</dt><dd className="break-words">{order.supplierName || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Warehouse</dt><dd className="break-words">{order.warehouseName || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Order date</dt><dd>{order.orderDate ? formatDate(order.orderDate) : '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Expected delivery</dt><dd>{order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : 'Not set'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Received date</dt><dd>{order.receivedDate ? formatDate(order.receivedDate) : 'Pending'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Currency</dt><dd>{order.currency}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <POFormDrawer open={editOpen} onClose={() => setEditOpen(false)} order={order} />
      {order.status === 'SENT' || order.status === 'PARTIAL' ? (
        <ReceiveItemsDrawer open={receiveOpen} onClose={() => setReceiveOpen(false)} order={order} />
      ) : null}
    </div>
  );
}
