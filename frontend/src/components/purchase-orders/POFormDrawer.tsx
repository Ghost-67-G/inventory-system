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
      expectedDeliveryDate: undefined,
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

    if (order) {
      reset({
        supplierId: order.supplierId,
        warehouseId: order.warehouseId,
        expectedDeliveryDate: order.expectedDeliveryDate ? order.expectedDeliveryDate.slice(0, 10) : undefined,
        supplierReference: order.supplierReference,
        taxRate: order.taxRate,
        shippingCost: order.shippingCost,
        notes: order.notes,
        lineItems: order.lineItems.map((line) => ({
          productId: line.productId,
          orderedQty: line.orderedQty,
          unitCost: line.unitCost,
          notes: line.notes
        }))
      });
      return;
    }

    reset({
      supplierId: '',
      warehouseId: '',
      expectedDeliveryDate: undefined,
      supplierReference: '',
      taxRate: 0,
      shippingCost: 0,
      notes: '',
      lineItems: [{ productId: prefillProductId ?? '', orderedQty: 1, unitCost: 0, notes: '' }]
    });
  }, [open, order, prefillProductId, reset]);

  const products = productsQuery.data?.pages.flatMap((page) => page.products) ?? [];
  const supplier = findSupplierById(suppliersQuery.data, watch('supplierId'));
  const lineItems = watch('lineItems');

  const subtotal = useMemo(
    () => lineItems.reduce((sum, line) => sum + (Number(line.orderedQty || 0) * Number(line.unitCost || 0)), 0),
    [lineItems]
  );
  const taxAmount = useMemo(() => (subtotal * Number(watch('taxRate') || 0)) / 100, [subtotal, watch]);
  const totalAmount = subtotal + taxAmount + Number(watch('shippingCost') || 0);

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

    if (order) {
      await updateMutation.mutateAsync({ id: order._id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }

    onClose();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{order ? 'Edit purchase order' : 'New purchase order'}</SheetTitle>
          <SheetDescription>{order ? 'Update draft order details' : 'Create a supplier purchase order'}</SheetDescription>
        </SheetHeader>

        <form className="space-y-5 py-6 pb-24" onSubmit={handleSubmit(onSubmit)}>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Order details</h3>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register('supplierId', { required: true })}
            >
              <option value="">Select supplier</option>
              {suppliersQuery.data?.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register('warehouseId', { required: true })}
            >
              <option value="">Select destination warehouse</option>
              {warehousesQuery.data?.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            <Input type="date" {...register('expectedDeliveryDate')} />
            <Input {...register('supplierReference')} placeholder="Supplier reference" />
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
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
                    value={lineItems[index]?.productId ?? ''}
                    onChange={(e) => {
                      setValue(`lineItems.${index}.productId`, e.target.value);
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

                  <Input type="number" min={1} {...register(`lineItems.${index}.orderedQty` as const, { valueAsNumber: true })} />
                  <Input type="number" min={0} step="0.01" {...register(`lineItems.${index}.unitCost` as const, { valueAsNumber: true })} />
                </div>

                <div className="flex items-center justify-between">
                  <Input {...register(`lineItems.${index}.notes` as const)} placeholder="Line notes (optional)" />
                  <Button type="button" variant="ghost" onClick={() => remove(index)} disabled={fields.length === 1}>
                    Remove
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Line total: {supplier?.currency ?? 'USD'} {(Number(lineItems[index]?.orderedQty || 0) * Number(lineItems[index]?.unitCost || 0)).toFixed(2)}
                </p>
              </div>
            ))}

            {errors.lineItems?.message ? <p className="text-xs text-red-500">{errors.lineItems.message}</p> : null}

            <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{supplier?.currency ?? 'USD'} {subtotal.toFixed(2)}</span></div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" step="0.01" {...register('taxRate', { valueAsNumber: true })} placeholder="Tax %" />
                <Input type="number" step="0.01" {...register('shippingCost', { valueAsNumber: true })} placeholder="Shipping" />
              </div>
              <div className="flex justify-between"><span>Tax amount</span><span>{supplier?.currency ?? 'USD'} {taxAmount.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{supplier?.currency ?? 'USD'} {totalAmount.toFixed(2)}</span></div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Notes</h3>
            <Textarea rows={4} {...register('notes')} />
          </section>

          <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between border-t border-border bg-background p-4 sm:absolute">
            <span className="text-sm font-semibold">Total: {supplier?.currency ?? 'USD'} {totalAmount.toFixed(2)}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>{order ? 'Save changes' : 'Create order'}</Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
