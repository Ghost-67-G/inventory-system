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
import type { IStockMovement } from '@/types';

export function PurchaseOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { formatDate, formatMoney } = useTenantFormatting();

  const orderQuery = usePurchaseOrder(id);
  const sendMutation = useSendPO();
  const cancelMutation = useCancelPO();

  const [editOpen, setEditOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const order = orderQuery.data;
  const movementsQuery = useMovements({});

  const movements = useMemo(
    () =>
      ((movementsQuery.data?.pages.flatMap((page) => page.movements) ?? []) as IStockMovement[]).filter(
        (movement) => movement.referenceId === id
      ),
    [id, movementsQuery.data]
  );

  if (!order) {
    return <div className="text-sm text-muted-foreground">Loading purchase order...</div>;
  }

  return (
    <div className="space-y-6">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/purchase-orders')}>
        <ArrowLeft className="h-4 w-4" />
        Purchase orders
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{order.poNumber}</h1>
          <div className="mt-2"><POStatusBadge status={order.status} /></div>
        </div>
        <div className="flex gap-2">
          {order.status === 'DRAFT' ? (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
              <Button onClick={() => void sendMutation.mutateAsync({ id: order._id, sendEmail: true })}>Send to supplier</Button>
              <Button variant="destructive" onClick={() => void cancelMutation.mutateAsync({ id: order._id })}>Cancel</Button>
            </>
          ) : null}
          {(order.status === 'SENT' || order.status === 'PARTIAL') ? (
            <>
              <Button onClick={() => setReceiveOpen(true)}>Receive items</Button>
              {order.status === 'SENT' ? <Button variant="destructive" onClick={() => void cancelMutation.mutateAsync({ id: order._id })}>Cancel</Button> : null}
            </>
          ) : null}
        </div>
      </div>

      {order.status === 'CANCELLED' && order.notes.includes('Stock already received is retained') ? (
        <div className="rounded-lg border border-amber-200 bg-amber-100 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Stock already received was not reversed when this partially received order was cancelled.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 font-semibold">Line items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2">Product</th>
                    <th>SKU</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Remaining</th>
                    <th>Unit cost</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lineItems.map((item) => {
                    const remaining = item.orderedQty - item.receivedQty;
                    const rowClass = remaining === 0 ? 'bg-green-50/60 dark:bg-green-900/10' : item.receivedQty > 0 ? 'bg-amber-50/60 dark:bg-amber-900/10' : '';
                    return (
                      <tr key={item.productId} className={`border-b border-border ${rowClass}`}>
                        <td className="py-2">{item.productName}</td>
                        <td>{item.productSku}</td>
                        <td>{item.orderedQty}</td>
                        <td>{item.receivedQty}</td>
                        <td>{remaining}</td>
                        <td>{formatMoney(item.unitCost)}</td>
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
              {order.notes ? <p className="text-sm"><strong>Notes:</strong> {order.notes}</p> : null}
              {order.supplierReference ? <p className="mt-2 text-sm"><strong>Supplier ref:</strong> {order.supplierReference}</p> : null}
            </div>
          ) : null}

          {(order.status === 'PARTIAL' || order.status === 'RECEIVED') ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 font-semibold">Stock movements</h3>
              <div className="space-y-2">
                {movements.length === 0 ? <p className="text-sm text-muted-foreground">No movements found</p> : null}
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
              <div><dt className="text-xs text-muted-foreground">Supplier</dt><dd>{order.supplierName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Warehouse</dt><dd>{order.warehouseName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Order date</dt><dd>{formatDate(order.orderDate)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Expected delivery</dt><dd>{order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : 'Not set'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Received date</dt><dd>{order.receivedDate ? formatDate(order.receivedDate) : 'Pending'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Currency</dt><dd>{order.currency}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <POFormDrawer open={editOpen} onClose={() => setEditOpen(false)} order={order} />
      <ReceiveItemsDrawer open={receiveOpen} onClose={() => setReceiveOpen(false)} order={order} />
    </div>
  );
}
