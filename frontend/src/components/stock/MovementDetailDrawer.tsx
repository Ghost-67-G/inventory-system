import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useMovement } from '@/hooks/useStock';

interface MovementDetailDrawerProps {
  movementId: string | null;
  open: boolean;
  onClose(): void;
}

export function MovementDetailDrawer({ movementId, open, onClose }: MovementDetailDrawerProps) {
  const { data: movement, isLoading } = useMovement(movementId);

  const signedQty = movement
    ? movement.type === 'IN' || movement.type === 'TRANSFER_IN'
      ? `+${movement.quantity}`
      : movement.type === 'ADJUSTMENT'
        ? `${movement.quantity}`
        : `-${movement.quantity}`
    : '';

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Movement details</SheetTitle>
        </SheetHeader>

        {isLoading || !movement ? (
          <div className="mt-6 text-sm text-slate-500">Loading movement...</div>
        ) : (
          <div className="mt-5 space-y-5 text-sm">
            <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {movement.type}
            </div>

            <section>
              <h3 className="font-semibold text-slate-800">Product</h3>
              <p>{movement.product?.name ?? '-'}</p>
              <p className="text-slate-500">
                {movement.product?.sku ?? '-'} {movement.product?.unit ? `- ${movement.product.unit}` : ''}
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-slate-800">Warehouse</h3>
              <p>{movement.warehouse?.name ?? '-'}</p>
              <p className="text-slate-500">{movement.warehouse?.code ?? '-'}</p>
            </section>

            <section>
              <h3 className="font-semibold text-slate-800">Quantity</h3>
              <p className="text-lg font-semibold">{signedQty} {movement.product?.unit ?? ''}</p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-slate-800">Stock levels</h3>
              <p>Before: {movement.quantityBefore} {movement.product?.unit ?? ''}</p>
              <p>After: {movement.quantityAfter} {movement.product?.unit ?? ''}</p>
              <p>Total stock before: {movement.totalStockBefore} {movement.product?.unit ?? ''}</p>
              <p>Total stock after: {movement.totalStockAfter} {movement.product?.unit ?? ''}</p>
            </section>

            <section>
              <h3 className="font-semibold text-slate-800">Reference</h3>
              <p>{movement.referenceType}</p>
              {movement.referenceId ? <p className="font-mono text-xs text-slate-500">{movement.referenceId}</p> : null}
            </section>

            <section>
              <h3 className="font-semibold text-slate-800">Note</h3>
              <p className="text-slate-700">{movement.note || '-'}</p>
            </section>

            <section>
              <h3 className="font-semibold text-slate-800">Performed by</h3>
              <p>{movement.performedByUser?.name ?? '-'}</p>
              <p className="text-slate-500">{movement.performedByUser?.email ?? '-'}</p>
            </section>

            <section>
              <h3 className="font-semibold text-slate-800">Timestamp</h3>
              <p>{format(new Date(movement.createdAt), 'PPP p')}</p>
            </section>

            {movement.pairedMovement ? (
              <section>
                <h3 className="font-semibold text-slate-800">Part of transfer</h3>
                <p>
                  {movement.type} in {movement.warehouse?.name} ({movement.quantity})
                </p>
                <p>
                  {movement.pairedMovement.type} in {movement.pairedMovement.warehouse?.name} ({movement.pairedMovement.quantity})
                </p>
              </section>
            ) : null}

            <Button onClick={onClose} className="w-full">Close</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
