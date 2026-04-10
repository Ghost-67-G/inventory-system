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
        productId: typeof link.productId === 'string' ? link.productId : '',
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
      minimumOrderQty: values.minimumOrderQty,
      leadTimeDays: values.leadTimeDays,
      isPreferred: values.isPreferred,
      notes: values.notes || undefined
    };

    if (isEdit && link) {
      await updateLinkMutation.mutateAsync({
        supplierId: supplier._id,
        productId: String(link.productId),
        data: payload
      });
    } else {
      await linkMutation.mutateAsync({
        supplierId: supplier._id,
        data: payload
      });
    }

    onClose();
  };

  const isLoading = linkMutation.isPending || updateLinkMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Update supplier product' : 'Link product to supplier'}</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm">Product</label>
            <select
              disabled={isEdit}
              value={watch('productId')}
              onChange={(e) => setValue('productId', e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            <label className="text-sm">Supplier SKU</label>
            <Input {...register('supplierSku')} placeholder="Supplier's own product code" />
          </div>

          <div>
            <label className="text-sm">Unit cost ({supplier.currency})</label>
            <Input type="number" step="0.01" {...register('unitCost', { valueAsNumber: true })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm">MOQ</label>
              <Input type="number" {...register('minimumOrderQty', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="text-sm">Lead time days</label>
              <Input type="number" {...register('leadTimeDays', { valueAsNumber: true })} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('isPreferred')} />
            Preferred supplier for this product
          </label>

          <div>
            <label className="text-sm">Notes</label>
            <Textarea rows={2} {...register('notes')} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isEdit ? 'Save changes' : 'Link product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
