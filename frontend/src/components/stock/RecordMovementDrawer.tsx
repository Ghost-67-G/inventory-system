import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useWindowSize } from '@/hooks/useWindowSize';
import { productsApi } from '@/api/endpoints/products';
import { useWarehousesDropdown } from '@/hooks/useWarehouses';
import {
  useProductStock,
  useRecordAdjustment,
  useRecordIn,
  useRecordOut,
  useRecordTransfer,
  useRecordWaste
} from '@/hooks/useStock';
import type { IProduct } from '@/types';

const baseSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  warehouseId: z.string().optional(),
  sourceWarehouseId: z.string().optional(),
  destinationWarehouseId: z.string().optional(),
  quantity: z.coerce.number(),
  note: z.string().max(500).optional().or(z.literal('')),
  referenceType: z.enum(['MANUAL', 'PURCHASE', 'SALE']).optional()
});

type FormValues = z.infer<typeof baseSchema>;

type DrawerType = 'in' | 'out' | 'adjustment' | 'waste' | 'transfer';

interface RecordMovementDrawerProps {
  open: boolean;
  onClose(): void;
  type: DrawerType;
  prefilledProductId?: string;
  prefilledWarehouseId?: string;
}

const TYPE_LABELS: Record<DrawerType, string> = {
  in: 'Record stock in',
  out: 'Record stock out',
  adjustment: 'Adjust stock',
  waste: 'Record waste',
  transfer: 'Transfer stock'
};

const BUTTON_LABELS: Record<DrawerType, string> = {
  in: 'Add stock',
  out: 'Remove stock',
  adjustment: 'Apply adjustment',
  waste: 'Record waste',
  transfer: 'Transfer stock'
};

export function RecordMovementDrawer({
  open,
  onClose,
  type,
  prefilledProductId,
  prefilledWarehouseId
}: RecordMovementDrawerProps) {
  const { width } = useWindowSize();
  const isMobile = width < 768;
  const [activeType, setActiveType] = useState<DrawerType>(type);
  const [search, setSearch] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      productId: prefilledProductId ?? '',
      warehouseId: prefilledWarehouseId ?? '',
      quantity: 0,
      note: '',
      referenceType: 'MANUAL'
    }
  });

  const recordIn = useRecordIn();
  const recordOut = useRecordOut();
  const recordAdjustment = useRecordAdjustment();
  const recordWaste = useRecordWaste();
  const recordTransfer = useRecordTransfer();

  useEffect(() => {
    setActiveType(type);
  }, [type]);

  useEffect(() => {
    form.reset({
      productId: prefilledProductId ?? form.getValues('productId') ?? '',
      warehouseId: prefilledWarehouseId ?? '',
      sourceWarehouseId: prefilledWarehouseId ?? '',
      destinationWarehouseId: '',
      quantity: 0,
      note: '',
      referenceType: 'MANUAL'
    });
  }, [activeType]);

  const { data: warehouses = [] } = useWarehousesDropdown();

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'drawer-search', search],
    queryFn: async () => {
      const res = await productsApi.list({ isActive: 'true', limit: 20, search: search || undefined });
      const payload = res.data as { data: { products: IProduct[] } };
      return payload.data.products;
    },
    staleTime: 30_000
  });

  const productId = form.watch('productId');
  const warehouseId = form.watch('warehouseId');
  const sourceWarehouseId = form.watch('sourceWarehouseId');
  const destinationWarehouseId = form.watch('destinationWarehouseId');
  const quantity = Number(form.watch('quantity') || 0);

  const selectedProduct = useMemo(() => products.find((p) => p._id === productId), [products, productId]);
  const { data: stock = [] } = useProductStock(productId || null);

  const selectedStock = stock.find((entry) => entry.warehouse._id === warehouseId);
  const sourceStock = stock.find((entry) => entry.warehouse._id === sourceWarehouseId);
  const destinationStock = stock.find((entry) => entry.warehouse._id === destinationWarehouseId);

  const mutationPending =
    recordIn.isPending ||
    recordOut.isPending ||
    recordAdjustment.isPending ||
    recordWaste.isPending ||
    recordTransfer.isPending;

  const submitError =
    (recordOut.error as any)?.response?.data?.message ||
    (recordWaste.error as any)?.response?.data?.message ||
    (recordTransfer.error as any)?.response?.data?.message ||
    '';

  const handleSubmit = form.handleSubmit(async (values) => {
    if (activeType !== 'transfer' && !values.warehouseId) {
      form.setError('warehouseId', { message: 'Warehouse is required' });
      return;
    }

    if (activeType === 'transfer') {
      if (!values.sourceWarehouseId || !values.destinationWarehouseId) {
        form.setError('sourceWarehouseId', { message: 'Source and destination are required' });
        return;
      }
      if (values.sourceWarehouseId === values.destinationWarehouseId) {
        form.setError('destinationWarehouseId', { message: 'Destination must differ from source' });
        return;
      }
    }

    if (activeType === 'adjustment') {
      if (!values.quantity || values.quantity === 0) {
        form.setError('quantity', { message: 'Adjustment quantity cannot be zero' });
        return;
      }
    } else if (values.quantity <= 0) {
      form.setError('quantity', { message: 'Quantity must be greater than 0' });
      return;
    }

    if (activeType === 'in') {
      await recordIn.mutateAsync({
        productId: values.productId,
        warehouseId: values.warehouseId as string,
        quantity: values.quantity,
        referenceType: values.referenceType === 'PURCHASE' ? 'PURCHASE' : 'MANUAL',
        note: values.note || undefined
      });
      onClose();
      return;
    }

    if (activeType === 'out') {
      await recordOut.mutateAsync({
        productId: values.productId,
        warehouseId: values.warehouseId as string,
        quantity: values.quantity,
        referenceType: values.referenceType === 'SALE' ? 'SALE' : 'MANUAL',
        note: values.note || undefined
      });
      onClose();
      return;
    }

    if (activeType === 'adjustment') {
      await recordAdjustment.mutateAsync({
        productId: values.productId,
        warehouseId: values.warehouseId as string,
        quantity: values.quantity,
        note: values.note || undefined
      });
      onClose();
      return;
    }

    if (activeType === 'waste') {
      await recordWaste.mutateAsync({
        productId: values.productId,
        warehouseId: values.warehouseId as string,
        quantity: values.quantity,
        note: values.note || undefined
      });
      onClose();
      return;
    }

    await recordTransfer.mutateAsync({
      productId: values.productId,
      sourceWarehouseId: values.sourceWarehouseId as string,
      destinationWarehouseId: values.destinationWarehouseId as string,
      quantity: values.quantity,
      note: values.note || undefined
    });
    onClose();
  });

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'h-[90vh] w-full overflow-y-auto' : 'w-full overflow-y-auto sm:max-w-xl'}>
        <SheetHeader>
          <SheetTitle>{TYPE_LABELS[activeType]}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          {(['in', 'out', 'adjustment', 'waste', 'transfer'] as DrawerType[]).map((movementType) => (
            <button
              key={movementType}
              type="button"
              onClick={() => setActiveType(movementType)}
              className={`min-h-11 rounded-md px-3 py-1.5 text-xs font-medium md:min-h-0 ${
                activeType === movementType ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {movementType[0].toUpperCase() + movementType.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 pb-24">
          <div className="space-y-1">
            <label className="text-sm font-medium">Search product</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by SKU or name" className="h-11 md:h-9" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Product</label>
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
              value={form.watch('productId')}
              disabled={Boolean(prefilledProductId)}
              onChange={(e) => form.setValue('productId', e.target.value)}
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.sku} - {product.name} ({product.unit})
                </option>
              ))}
            </select>
          </div>

          {activeType !== 'transfer' ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Warehouse</label>
              <select
                className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
                value={form.watch('warehouseId')}
                onChange={(e) => form.setValue('warehouseId', e.target.value)}
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse._id} value={warehouse._id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Source warehouse</label>
                <select
                  className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
                  value={form.watch('sourceWarehouseId')}
                  onChange={(e) => form.setValue('sourceWarehouseId', e.target.value)}
                >
                  <option value="">Select source warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.code} - {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Destination warehouse</label>
                <select
                  className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
                  value={form.watch('destinationWarehouseId')}
                  onChange={(e) => form.setValue('destinationWarehouseId', e.target.value)}
                >
                  <option value="">Select destination warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.code} - {warehouse.name}
                    </option>
                  ))}
                </select>
                {sourceWarehouseId && destinationWarehouseId && sourceWarehouseId === destinationWarehouseId ? (
                  <p className="text-xs text-red-600">Source and destination cannot be the same.</p>
                ) : null}
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Quantity {selectedProduct ? `(${selectedProduct.unit})` : ''}</label>
            <Input
              type="number"
              step="any"
              value={Number.isNaN(quantity) ? '' : quantity}
              onChange={(e) => form.setValue('quantity', Number(e.target.value))}
              className="h-11 md:h-9"
            />
            {activeType === 'adjustment' ? (
              <p className="text-xs text-muted-foreground">Positive to add stock, negative to remove.</p>
            ) : null}
          </div>

          {(activeType === 'in' || activeType === 'out') && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Reference (optional)</label>
              <select
                className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
                value={form.watch('referenceType') ?? 'MANUAL'}
                onChange={(e) => form.setValue('referenceType', e.target.value as 'MANUAL' | 'PURCHASE' | 'SALE')}
              >
                <option value="MANUAL">Manual</option>
                {activeType === 'in' ? <option value="PURCHASE">Purchase order</option> : null}
                {activeType === 'out' ? <option value="SALE">Sale</option> : null}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Note</label>
            <Textarea
              rows={2}
              placeholder={
                activeType === 'in'
                  ? 'e.g. Purchase order #1234'
                  : activeType === 'out'
                    ? 'e.g. Sale to customer ABC'
                    : activeType === 'adjustment'
                      ? 'e.g. Physical count correction'
                      : activeType === 'waste'
                        ? 'e.g. Expired batch, damaged in transit'
                        : 'e.g. Moving to main warehouse for winter'
              }
              value={form.watch('note') ?? ''}
              onChange={(e) => form.setValue('note', e.target.value)}
            />
          </div>

          {activeType !== 'transfer' && selectedStock ? (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div>
                Current stock: <strong>{selectedStock.quantity}</strong> {selectedProduct?.unit ?? ''} in {selectedStock.warehouse.name}
              </div>
              <div className="mt-1">
                After:{' '}
                <strong>
                  {activeType === 'in'
                    ? selectedStock.quantity + quantity
                    : activeType === 'adjustment'
                      ? selectedStock.quantity + quantity
                      : selectedStock.quantity - quantity}
                </strong>{' '}
                {selectedProduct?.unit ?? ''}
              </div>
            </div>
          ) : null}

          {activeType === 'transfer' && sourceStock && destinationStock ? (
            <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div>
                Source after: <strong>{sourceStock.quantity - quantity}</strong> {selectedProduct?.unit ?? ''}
              </div>
              <div>
                Destination after: <strong>{destinationStock.quantity + quantity}</strong> {selectedProduct?.unit ?? ''}
              </div>
            </div>
          ) : null}

          {submitError ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submitError}</div> : null}

          <div className="fixed bottom-0 left-0 right-0 w-full border-t bg-background p-4 md:left-auto md:w-lg">
            <Button type="submit" className="h-11 min-h-11 w-full md:h-9 md:min-h-0" disabled={mutationPending}>
              {BUTTON_LABELS[activeType]}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
