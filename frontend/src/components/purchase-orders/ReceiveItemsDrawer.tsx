import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { format } from 'date-fns';
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
    () => (order.lineItems ?? []).filter((item) => item.orderedQty - item.receivedQty > 0),
    [order.lineItems]
  );

  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors }
  } = useForm<FormData>({
    defaultValues: {
      receivedDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      lineItems: []
    }
  });

  const { fields } = useFieldArray({ control, name: 'lineItems' });

  useEffect(() => {
    if (!open) return;

    receiveMutation.reset();
    reset({
      receivedDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      lineItems: unreceivedLineItems.map((line) => ({
        productId: line.productId,
        receivedQty: line.orderedQty - line.receivedQty,
        notes: ''
      }))
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset, unreceivedLineItems]);

  const watchedLines = watch('lineItems') ?? [];
  const totals = useMemo(() => {
    const quantity = watchedLines.reduce((sum, line) => sum + Number(line.receivedQty || 0), 0);
    const products = watchedLines.filter((line) => Number(line.receivedQty || 0) > 0).length;
    return { quantity, products };
  }, [watchedLines]);

  const onSubmit = async (values: FormData) => {
    const validItems = values.lineItems.filter((line) => Number(line.receivedQty || 0) > 0);

    if (validItems.length === 0) {
      setError('lineItems', { type: 'manual', message: 'Enter a quantity greater than 0 for at least one product' });
      return;
    }
    clearErrors('lineItems');

    try {
      await receiveMutation.mutateAsync({
        id: order._id,
        data: {
          receivedDate: values.receivedDate || undefined,
          lineItems: validItems.map((line) => ({
            productId: line.productId,
            receivedQty: Number(line.receivedQty),
            notes: line.notes || values.notes || undefined
          }))
        }
      });
    } catch {
      // Error is surfaced by the mutation hook's toast.
      return;
    }

    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Receive items</SheetTitle>
          <SheetDescription>
            PO {order.poNumber} - {order.supplierName}
          </SheetDescription>
        </SheetHeader>

        <form className="space-y-4 pt-6" onSubmit={handleSubmit(onSubmit)}>
          {unreceivedLineItems.length === 0 ? (
            <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">All items on this order have already been received.</p>
          ) : null}

          {fields.map((field, index) => {
            const source = unreceivedLineItems[index];
            if (!source) return null;

            const remaining = source.orderedQty - source.receivedQty;
            const lineError = errors.lineItems?.[index]?.receivedQty?.message;

            return (
              <div key={field.id} className="rounded-lg border border-border p-3">
                <p className="break-words font-medium">{source.productName}</p>
                <p className="font-mono text-xs text-muted-foreground">{source.productSku}</p>
                <p className="mt-1 text-xs text-muted-foreground">Ordered: {source.orderedQty} {source.unit}</p>
                {source.receivedQty > 0 ? <p className="text-xs text-muted-foreground">Already received: {source.receivedQty}</p> : null}
                <p className="text-xs text-muted-foreground">Remaining: {remaining} {source.unit}</p>

                <label htmlFor={`receive-line-${index}`} className="mt-2 block text-xs font-medium text-muted-foreground">Quantity to receive</label>
                <Input
                  id={`receive-line-${index}`}
                  type="number"
                  min={0}
                  max={remaining}
                  step="1"
                  inputMode="numeric"
                  className="mt-1"
                  aria-invalid={Boolean(lineError)}
                  {...register(`lineItems.${index}.receivedQty` as const, {
                    valueAsNumber: true,
                    required: 'Enter a quantity (0 to skip this line)',
                    min: { value: 0, message: 'Quantity cannot be negative' },
                    max: { value: remaining, message: `Cannot receive more than the remaining ${remaining}` },
                    validate: (value) => Number.isInteger(value) || 'Quantity must be a whole number'
                  })}
                />
                {lineError ? <p className="mt-1 text-xs text-destructive">{lineError}</p> : null}
              </div>
            );
          })}

          {errors.lineItems?.message ? <p className="text-xs text-destructive">{errors.lineItems.message}</p> : null}

          <div className="space-y-1">
            <label htmlFor="receive-date" className="text-xs font-medium text-muted-foreground">Received date</label>
            <Input id="receive-date" type="date" className="min-w-0" {...register('receivedDate', { required: 'Received date is required' })} />
            {errors.receivedDate?.message ? <p className="text-xs text-destructive">{errors.receivedDate.message}</p> : null}
          </div>
          <div className="space-y-1">
            <label htmlFor="receive-notes" className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea id="receive-notes" rows={3} placeholder="Notes for this receipt" {...register('notes')} />
          </div>

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

          <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-border bg-background p-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={receiveMutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={receiveMutation.isPending || unreceivedLineItems.length === 0}>
              {receiveMutation.isPending ? 'Recording...' : 'Confirm receipt'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
