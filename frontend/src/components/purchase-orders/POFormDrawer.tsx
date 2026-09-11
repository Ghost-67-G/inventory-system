import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { suppliersApi } from '@/api/endpoints/suppliers';
import { useProducts } from '@/hooks/useProducts';
import { useCreatePO, useUpdatePO } from '@/hooks/usePurchaseOrders';
import { useSuppliersDropdown } from '@/hooks/useSuppliers';
import { useWarehousesDropdown } from '@/hooks/useWarehouses';
import type { CreatePODto, IPurchaseOrder, ISupplierDropdownItem } from '@/types';

interface POFormDrawerProps {
  open: boolean;
  onClose: () => void;
  order?: IPurchaseOrder;
  prefillProductId?: string;
}

interface LineItemForm {
  productId: string;
  orderedQty: number;
  unitCost: number;
  notes?: string;
}

interface FormData {
  supplierId: string;
  warehouseId: string;
  expectedDeliveryDate?: string;
  supplierReference?: string;
  taxRate: number;
  shippingCost: number;
  notes?: string;
  lineItems: LineItemForm[];
}

function findSupplierById(list: ISupplierDropdownItem[] | undefined, id: string): ISupplierDropdownItem | undefined {
  return list?.find((supplier) => supplier._id === id);
}

export function POFormDrawer({ open, onClose, order, prefillProductId }: POFormDrawerProps) {
  const isEdit = Boolean(order);
  const createMutation = useCreatePO();
  const updateMutation = useUpdatePO();
  const suppliersQuery = useSuppliersDropdown();
  const warehousesQuery = useWarehousesDropdown();
  const productsQuery = useProducts({ isActive: 'true', limit: 100 });

  const {
    control,
    register,
    watch,
    setValue,
    setError,
    clearErrors,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    defaultValues: {
      supplierId: '',
      warehouseId: '',
      expectedDeliveryDate: '',
      supplierReference: '',
      taxRate: 0,
      shippingCost: 0,
      notes: '',
      lineItems: [{ productId: prefillProductId ?? '', orderedQty: 1, unitCost: 0, notes: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems'
  });

  useEffect(() => {
    if (!open) return;

    createMutation.reset();
    updateMutation.reset();

    if (order) {
      reset({
        supplierId: order.supplierId,
        warehouseId: order.warehouseId,
        expectedDeliveryDate: order.expectedDeliveryDate ? order.expectedDeliveryDate.slice(0, 10) : '',
        supplierReference: order.supplierReference ?? '',
        taxRate: order.taxRate ?? 0,
        shippingCost: order.shippingCost ?? 0,
        notes: order.notes ?? '',
        lineItems: (order.lineItems ?? []).map((line) => ({
          productId: line.productId,
          orderedQty: line.orderedQty,
          unitCost: line.unitCost,
          notes: line.notes ?? ''
        }))
      });
      return;
    }

    reset({
      supplierId: '',
      warehouseId: '',
      expectedDeliveryDate: '',
      supplierReference: '',
      taxRate: 0,
      shippingCost: 0,
      notes: '',
      lineItems: [{ productId: prefillProductId ?? '', orderedQty: 1, unitCost: 0, notes: '' }]
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order, prefillProductId, reset]);

  const products = productsQuery.data?.pages.flatMap((page) => page.products) ?? [];
  const supplier = findSupplierById(suppliersQuery.data, watch('supplierId'));
  const lineItems = watch('lineItems') ?? [];
  const taxRateValue = Number(watch('taxRate') || 0);
  const shippingCostValue = Number(watch('shippingCost') || 0);
  const currency = supplier?.currency ?? 'USD';

  const subtotal = useMemo(
    () => lineItems.reduce((sum, line) => sum + (Number(line.orderedQty || 0) * Number(line.unitCost || 0)), 0),
    [lineItems]
  );
  // Depend on the watched value itself; `watch` is a stable function reference so
  // depending on it never re-ran this memo when the tax rate changed.
  const taxAmount = useMemo(() => (subtotal * taxRateValue) / 100, [subtotal, taxRateValue]);
  const totalAmount = subtotal + taxAmount + shippingCostValue;

  const maybeAutofillCost = async (lineIndex: number, productId: string) => {
    const supplierId = watch('supplierId');
    if (!supplierId || !productId) return;

    try {
      const response = await suppliersApi.getProductSuppliers(productId);
      const links = (response.data as { data?: { suppliers?: any[] } }).data?.suppliers ?? [];
      const linksForSupplier = links.filter((link) => {
        const linkedSupplierId = typeof link.supplierId === 'string' ? link.supplierId : link.supplierId?._id;
        return linkedSupplierId === supplierId;
      });

      const preferred = linksForSupplier.find((link) => link.isPreferred) ?? linksForSupplier[0];
      if (preferred?.unitCost != null) {
        setValue(`lineItems.${lineIndex}.unitCost`, Number(preferred.unitCost));
      }
    } catch {
      // no-op for optional prefill
    }
  };

  const validateNoDuplicateProducts = (lines: LineItemForm[]): boolean => {
    if (lines.length === 0) {
      setError('lineItems', { type: 'manual', message: 'Add at least one product' });
      return false;
    }
    if (lines.some((line) => !line.productId)) {
      setError('lineItems', { type: 'manual', message: 'Select a product for every line' });
      return false;
    }
    if (lines.some((line) => !Number.isFinite(Number(line.orderedQty)) || Number(line.orderedQty) < 1)) {
      setError('lineItems', { type: 'manual', message: 'Each line needs a quantity of at least 1' });
      return false;
    }
    if (lines.some((line) => !Number.isFinite(Number(line.unitCost)) || Number(line.unitCost) < 0)) {
      setError('lineItems', { type: 'manual', message: 'Unit cost cannot be negative' });
      return false;
    }
    const ids = lines.map((line) => line.productId).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      setError('lineItems', { type: 'manual', message: 'Duplicate products are not allowed' });
      return false;
    }
    clearErrors('lineItems');
    return true;
  };

  const onSubmit = async (values: FormData) => {
    if (!validateNoDuplicateProducts(values.lineItems)) {
      return;
    }

    const payload: CreatePODto = {
      supplierId: values.supplierId,
      warehouseId: values.warehouseId,
      expectedDeliveryDate: values.expectedDeliveryDate || undefined,
      supplierReference: values.supplierReference || undefined,
      notes: values.notes || undefined,
      taxRate: Number(values.taxRate || 0),
      shippingCost: Number(values.shippingCost || 0),
      lineItems: values.lineItems.map((line) => ({
        productId: line.productId,
        orderedQty: Number(line.orderedQty),
        unitCost: Number(line.unitCost),
        notes: line.notes || undefined
      }))
    };

    try {
      if (order) {
        await updateMutation.mutateAsync({ id: order._id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch {
      // Errors are surfaced by the mutation hooks' toasts.
      return;
    }

    onClose();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{order ? 'Edit purchase order' : 'New purchase order'}</SheetTitle>
          <SheetDescription>{order ? 'Update draft order details' : 'Create a supplier purchase order'}</SheetDescription>
        </SheetHeader>

        <form className="space-y-5 pt-6" onSubmit={handleSubmit(onSubmit)}>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Order details</h3>
            <div className="space-y-1">
              <label htmlFor="po-supplier" className="text-xs font-medium text-muted-foreground">Supplier</label>
              <select
                id="po-supplier"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground aria-invalid:border-destructive"
                aria-invalid={Boolean(errors.supplierId)}
                {...register('supplierId', { required: 'Supplier is required' })}
              >
                <option value="">Select supplier</option>
                {suppliersQuery.data?.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
              {errors.supplierId?.message ? <p className="text-xs text-destructive">{errors.supplierId.message}</p> : null}
            </div>
            <div className="space-y-1">
              <label htmlFor="po-warehouse" className="text-xs font-medium text-muted-foreground">Destination warehouse</label>
              <select
                id="po-warehouse"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground aria-invalid:border-destructive"
                aria-invalid={Boolean(errors.warehouseId)}
                {...register('warehouseId', { required: 'Destination warehouse is required' })}
              >
                <option value="">Select destination warehouse</option>
                {warehousesQuery.data?.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
              {errors.warehouseId?.message ? <p className="text-xs text-destructive">{errors.warehouseId.message}</p> : null}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="po-expected" className="text-xs font-medium text-muted-foreground">Expected delivery</label>
                <Input id="po-expected" type="date" className="min-w-0" {...register('expectedDeliveryDate')} />
              </div>
              <div className="space-y-1">
                <label htmlFor="po-supplier-ref" className="text-xs font-medium text-muted-foreground">Supplier reference</label>
                <Input id="po-supplier-ref" {...register('supplierReference')} placeholder="Supplier reference" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Products</h3>
              <Button type="button" variant="outline" onClick={() => append({ productId: '', orderedQty: 1, unitCost: 0, notes: '' })}>
                Add product
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label htmlFor={`po-line-${index}-product`} className="text-xs font-medium text-muted-foreground">Product</label>
                    <select
                      id={`po-line-${index}-product`}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      value={lineItems[index]?.productId ?? ''}
                      onChange={(e) => {
                        setValue(`lineItems.${index}.productId`, e.target.value, { shouldDirty: true });
                        clearErrors('lineItems');
                        void maybeAutofillCost(index, e.target.value);
                      }}
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.sku} - {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={`po-line-${index}-qty`} className="text-xs font-medium text-muted-foreground">Quantity</label>
                    <Input
                      id={`po-line-${index}-qty`}
                      type="number"
                      min={1}
                      step="1"
                      inputMode="numeric"
                      placeholder="Qty"
                      aria-invalid={Boolean(errors.lineItems?.[index]?.orderedQty)}
                      {...register(`lineItems.${index}.orderedQty` as const, { valueAsNumber: true, required: 'Required', min: { value: 1, message: 'Min 1' } })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`po-line-${index}-cost`} className="text-xs font-medium text-muted-foreground">Unit cost</label>
                    <Input
                      id={`po-line-${index}-cost`}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-invalid={Boolean(errors.lineItems?.[index]?.unitCost)}
                      {...register(`lineItems.${index}.unitCost` as const, { valueAsNumber: true, required: 'Required', min: { value: 0, message: 'Cannot be negative' } })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Input {...register(`lineItems.${index}.notes` as const)} placeholder="Line notes (optional)" aria-label={`Line ${index + 1} notes`} />
                  <Button type="button" variant="ghost" className="shrink-0" onClick={() => { remove(index); clearErrors('lineItems'); }} disabled={fields.length === 1}>
                    Remove
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Line total: {currency} {(Number(lineItems[index]?.orderedQty || 0) * Number(lineItems[index]?.unitCost || 0)).toFixed(2)}
                </p>
              </div>
            ))}

            {errors.lineItems?.message ? <p className="text-xs text-destructive">{errors.lineItems.message}</p> : null}

            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{currency} {subtotal.toFixed(2)}</span></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="po-tax-rate" className="text-xs font-medium text-muted-foreground">Tax rate (%)</label>
                  <Input id="po-tax-rate" type="number" min={0} step="0.01" inputMode="decimal" {...register('taxRate', { valueAsNumber: true, min: 0 })} placeholder="Tax %" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="po-shipping" className="text-xs font-medium text-muted-foreground">Shipping cost</label>
                  <Input id="po-shipping" type="number" min={0} step="0.01" inputMode="decimal" {...register('shippingCost', { valueAsNumber: true, min: 0 })} placeholder="Shipping" />
                </div>
              </div>
              <div className="flex justify-between"><span>Tax amount</span><span>{currency} {taxAmount.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{currency} {totalAmount.toFixed(2)}</span></div>
            </div>
          </section>

          <section>
            <label htmlFor="po-notes" className="mb-2 block text-sm font-semibold">Notes</label>
            <Textarea id="po-notes" rows={4} {...register('notes')} />
          </section>

          <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background p-4">
            <span className="text-sm font-semibold">Total: {currency} {totalAmount.toFixed(2)}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : order ? 'Save changes' : 'Create order'}</Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
