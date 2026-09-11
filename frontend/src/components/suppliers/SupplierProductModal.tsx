import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/hooks/useProducts';
import { useLinkProduct, useUpdateSupplierProduct } from '@/hooks/useSuppliers';
import type { ISupplier, ISupplierProduct } from '@/types';

interface SupplierProductModalProps {
  open: boolean;
  onClose: () => void;
  supplier: ISupplier;
  link?: ISupplierProduct;
}

/** `productId` is typed as a string but may arrive populated from the API. */
function getLinkProductId(link: ISupplierProduct): string {
  const productId = link.productId as unknown;
  if (typeof productId === 'string') return productId;
  if (productId && typeof productId === 'object' && '_id' in productId) {
    return String((productId as { _id: unknown })._id);
  }
  return '';
}

interface FormValues {
  productId: string;
  supplierSku: string;
  unitCost: number;
  minimumOrderQty: number;
  leadTimeDays?: number;
  isPreferred: boolean;
  notes: string;
}

export function SupplierProductModal({ open, onClose, supplier, link }: SupplierProductModalProps) {
  const isEdit = Boolean(link);
  const productsQuery = useProducts({ limit: 100, isActive: 'true' });
  const linkMutation = useLinkProduct();
  const updateLinkMutation = useUpdateSupplierProduct();

  const { register, handleSubmit, setValue, reset, watch } = useForm<FormValues>({
    defaultValues: {
      productId: '',
      supplierSku: '',
      unitCost: 0,
      minimumOrderQty: 1,
      leadTimeDays: supplier.leadTimeDays,
      isPreferred: false,
      notes: ''
    }
  });

  useEffect(() => {
    if (!open) return;
    if (link) {
      reset({
        productId: getLinkProductId(link),
        supplierSku: link.supplierSku,
        unitCost: link.unitCost,
        minimumOrderQty: link.minimumOrderQty,
        leadTimeDays: link.leadTimeDays,
        isPreferred: link.isPreferred,
        notes: link.notes
      });
    } else {
      reset({
        productId: '',
        supplierSku: '',
        unitCost: 0,
        minimumOrderQty: 1,
        leadTimeDays: supplier.leadTimeDays,
        isPreferred: false,
        notes: ''
      });
    }
  }, [open, link, reset, supplier.leadTimeDays]);

  const products = productsQuery.data?.pages.flatMap((page) => page.products) ?? [];

  const onSubmit = async (values: FormValues) => {
    const payload = {
      productId: values.productId,
      supplierSku: values.supplierSku || undefined,
      unitCost: values.unitCost,
      // valueAsNumber yields NaN for an emptied input; never send NaN to the API.
      minimumOrderQty: Number.isFinite(values.minimumOrderQty) ? values.minimumOrderQty : 1,
      leadTimeDays: Number.isFinite(values.leadTimeDays) ? values.leadTimeDays : undefined,
      isPreferred: values.isPreferred,
      notes: values.notes || undefined
    };

    try {
      if (isEdit && link) {
        await updateLinkMutation.mutateAsync({
          supplierId: supplier._id,
          productId: getLinkProductId(link),
          data: payload
        });
      } else {
        await linkMutation.mutateAsync({
          supplierId: supplier._id,
          data: payload
        });
      }

      onClose();
    } catch {
      // error toast is handled by the mutation hook; keep the modal open
    }
  };

  const isLoading = linkMutation.isPending || updateLinkMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Update supplier product' : 'Link product to supplier'}</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="supplier-product-id" className="text-sm text-foreground">Product</label>
            <select
              id="supplier-product-id"
              disabled={isEdit}
              required={!isEdit}
              value={watch('productId')}
              onChange={(e) => setValue('productId', e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.sku} - {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="supplier-product-sku" className="text-sm text-foreground">Supplier SKU</label>
            <Input id="supplier-product-sku" {...register('supplierSku')} placeholder="Supplier's own product code" />
          </div>

          <div>
            <label htmlFor="supplier-product-cost" className="text-sm text-foreground">Unit cost ({supplier.currency})</label>
            <Input id="supplier-product-cost" type="number" step="0.01" min={0} required {...register('unitCost', { valueAsNumber: true })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="supplier-product-moq" className="text-sm text-foreground">MOQ</label>
              <Input id="supplier-product-moq" type="number" min={1} {...register('minimumOrderQty', { valueAsNumber: true })} />
            </div>
            <div>
              <label htmlFor="supplier-product-lead" className="text-sm text-foreground">Lead time days</label>
              <Input id="supplier-product-lead" type="number" min={0} {...register('leadTimeDays', { valueAsNumber: true })} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('isPreferred')} />
            Preferred supplier for this product
          </label>

          <div>
            <label htmlFor="supplier-product-notes" className="text-sm text-foreground">Notes</label>
            <Textarea id="supplier-product-notes" rows={2} {...register('notes')} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEdit ? 'Save changes' : 'Link product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
