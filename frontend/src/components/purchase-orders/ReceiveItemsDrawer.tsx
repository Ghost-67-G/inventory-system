import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useReceiveItems } from '@/hooks/usePurchaseOrders';
import type { IPurchaseOrder } from '@/types';

interface ReceiveItemsDrawerProps {
  open: boolean;
  onClose: () => void;
  order: IPurchaseOrder;
}

interface FormData {
  receivedDate: string;
  notes?: string;
  lineItems: Array<{
    productId: string;
    receivedQty: number;
    notes?: string;
  }>;
}

export function ReceiveItemsDrawer({ open, onClose, order }: ReceiveItemsDrawerProps) {
  const receiveMutation = useReceiveItems();

  const unreceivedLineItems = useMemo(
    () => order.lineItems.filter((item) => item.orderedQty - item.receivedQty > 0),
    [order.lineItems]
  );

  const { control, register, reset, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      receivedDate: new Date().toISOString().slice(0, 10),
      notes: '',
      lineItems: []
    }
  });

  const { fields } = useFieldArray({ control, name: 'lineItems' });

  useEffect(() => {
    if (!open) return;

    reset({
      receivedDate: new Date().toISOString().slice(0, 10),
      notes: '',
      lineItems: unreceivedLineItems.map((line) => ({
        productId: line.productId,
        receivedQty: line.orderedQty - line.receivedQty,
        notes: ''
      }))
    });
  }, [open, reset, unreceivedLineItems]);

  const watchedLines = watch('lineItems');
  const totals = useMemo(() => {
    const quantity = watchedLines.reduce((sum, line) => sum + Number(line.receivedQty || 0), 0);
    const products = watchedLines.filter((line) => Number(line.receivedQty || 0) > 0).length;
    return { quantity, products };
  }, [watchedLines]);

  const onSubmit = async (values: FormData) => {
    const validItems = values.lineItems.filter((line) => Number(line.receivedQty || 0) > 0);

    await receiveMutation.mutateAsync({
      id: order._id,
      data: {
        receivedDate: values.receivedDate,
        lineItems: validItems.map((line) => ({
          productId: line.productId,
          receivedQty: Number(line.receivedQty),
          notes: line.notes || values.notes || undefined
        }))
      }
    });

    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Receive items</SheetTitle>
          <SheetDescription>
            PO {order.poNumber} - {order.supplierName}
          </SheetDescription>
        </SheetHeader>

        <form className="space-y-4 py-6 pb-20" onSubmit={handleSubmit(onSubmit)}>
          {fields.map((field, index) => {
            const source = unreceivedLineItems[index];
            if (!source) return null;

            const remaining = source.orderedQty - source.receivedQty;

            return (
              <div key={field.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{source.productName}</p>
                <p className="text-xs text-muted-foreground">{source.productSku}</p>
                <p className="mt-1 text-xs text-muted-foreground">Ordered: {source.orderedQty} {source.unit}</p>
                {source.receivedQty > 0 ? <p className="text-xs text-muted-foreground">Already received: {source.receivedQty}</p> : null}
                <p className="text-xs text-muted-foreground">Remaining: {remaining} {source.unit}</p>

                <Input
                  type="number"
                  min={0}
                  max={remaining}
                  step="1"
                  className="mt-2"
                  {...register(`lineItems.${index}.receivedQty` as const, { valueAsNumber: true })}
                />
              </div>
            );
          })}

          <Input type="date" {...register('receivedDate')} />
          <Textarea rows={3} placeholder="Notes for this receipt" {...register('notes')} />

          <div className="rounded-lg border border-border p-3 text-sm">
            <p>
              Receiving {totals.quantity} items across {totals.products} products.
            </p>
            <p className="text-muted-foreground">
              {totals.products === unreceivedLineItems.length
                ? 'This can mark the order as RECEIVED if all quantities are complete.'
                : 'This will keep the order in PARTIAL until all items are fully received.'}
            </p>
          </div>

          <div className="fixed bottom-0 left-0 right-0 flex justify-end gap-2 border-t border-border bg-background p-4 sm:absolute">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={receiveMutation.isPending}>
              {receiveMutation.isPending ? 'Recording...' : 'Confirm receipt'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
