import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useCategoriesDropdown } from '@/hooks/useCategories';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useTenantStore } from '@/store/tenantStore';
import type { IProduct, CreateProductDto } from '@/types';

const UNIT_PRESETS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'carton', 'dozen', 'pair', 'set', 'roll', 'sheet', 'bag'];

interface ProductFormDrawerProps {
  mode: 'create' | 'edit';
  product?: IProduct;
  open: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional().default(''),
  categoryId: z.string().or(z.null()).optional(),
  unit: z.string().min(1, 'Unit is required').max(50),
  costPrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({})
});

type FormData = z.infer<typeof formSchema>;

export default function ProductFormDrawer({ mode, product, open, onClose }: ProductFormDrawerProps) {
  const { width } = useWindowSize();
  const isMobile = width < 768;
  const { data: categories } = useCategoriesDropdown();
  const tenant = useTenantStore((state) => state.tenant);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct(product?._id ?? '');

  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [currentTag, setCurrentTag] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      categoryId: null,
      unit: '',
      costPrice: 0,
      sellingPrice: 0,
      lowStockThreshold: 0,
      images: [],
      tags: [],
      customFields: {}
    }
  });

  const watchImages = watch('images');
  const watchTags = watch('tags');
  const watchUnit = watch('unit');
  const watchCustomFields = watch('customFields');
  const costPrice = watch('costPrice');
  const sellingPrice = watch('sellingPrice');

  const defaultCustomFields = useMemo(
    () =>
      (tenant?.customFields ?? []).reduce<Record<string, unknown>>((acc, field) => {
        acc[field.key] = field.defaultValue ?? '';
        return acc;
      }, {}),
    [tenant?.customFields]
  );

  // Calculate profit margin. Number inputs registered without valueAsNumber
  // yield strings, so coerce explicitly and clear the margin when the selling
  // price is emptied (the previous effect kept a stale value in that case).
  const profitMargin = useMemo(() => {
    const cost = Number(costPrice);
    const sell = Number(sellingPrice);
    if (!Number.isFinite(cost) || !Number.isFinite(sell) || sell <= 0) return null;
    const margin = ((sell - cost) / sell) * 100;
    return Number.isFinite(margin) ? margin : null;
  }, [costPrice, sellingPrice]);

  // Keep the latest product in a ref so the prefill effect only runs when the
  // drawer opens or the target product changes, not on every refetch of the
  // same product (which would wipe in-progress edits).
  const productRef = useRef(product);
  productRef.current = product;
  const productId = product?._id;

  // Pre-fill form in edit mode
  useEffect(() => {
    if (!open) return;
    setCurrentTag('');
    setCurrentImageUrl('');
    const current = productRef.current;
    if (mode === 'edit' && current) {
      reset({
        sku: current.sku,
        name: current.name,
        description: current.description ?? '',
        categoryId: current.categoryId ?? null,
        unit: current.unit,
        costPrice: current.costPrice,
        sellingPrice: current.sellingPrice,
        lowStockThreshold: current.lowStockThreshold,
        images: current.images ?? [],
        tags: current.tags ?? [],
        customFields: current.customFields ?? {}
      });
    } else if (mode === 'create') {
      reset({
        sku: '',
        name: '',
        description: '',
        categoryId: null,
        unit: '',
        costPrice: 0,
        sellingPrice: 0,
        lowStockThreshold: 0,
        images: [],
        tags: [],
        customFields: defaultCustomFields
      });
    }
  }, [mode, open, productId, reset, defaultCustomFields]);

  const onSubmit = async (data: FormData) => {
    // Custom fields are dynamic (per tenant), so the static zod schema cannot
    // enforce their `required` flag; check it here before submitting.
    const missingRequired = (tenant?.customFields ?? []).filter((field) => {
      if (!field.required || field.type === 'boolean') return false;
      const value = data.customFields?.[field.key];
      return value === undefined || value === null || value === '';
    });
    if (missingRequired.length > 0) {
      setError('customFields', {
        type: 'manual',
        message: `${missingRequired.map((field) => field.name).join(', ')} ${missingRequired.length === 1 ? 'is' : 'are'} required`
      });
      return;
    }

    try {
      const payload: CreateProductDto = {
        ...data,
        categoryId: data.categoryId || null
      };

      if (mode === 'create') {
        await createMutation.mutateAsync(payload);
      } else if (product) {
        await updateMutation.mutateAsync(payload);
      }

      onClose();
      reset();
    } catch (error) {
      // Error is handled by mutation
    }
  };

  const addImage = () => {
    const url = currentImageUrl.trim();
    if (url && watchImages.length < 10) {
      setValue('images', [...watchImages, url]);
      setCurrentImageUrl('');
    }
  };

  const removeImage = (index: number) => {
    setValue('images', watchImages.filter((_, i) => i !== index));
  };

  const addTag = () => {
    const tag = currentTag.toLowerCase().trim();
    if (tag && watchTags.length < 20 && !watchTags.includes(tag)) {
      setValue('tags', [...watchTags, tag]);
      setCurrentTag('');
    }
  };

  const removeTag = (index: number) => {
    setValue('tags', watchTags.filter((_, i) => i !== index));
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'h-[90vh] w-full overflow-y-auto' : 'w-full overflow-y-auto sm:max-w-2xl'}>
        <SheetHeader>
          <SheetTitle>{mode === 'create' ? 'Add Product' : 'Edit Product'}</SheetTitle>
          <SheetDescription>
            {mode === 'create' ? 'Create a new product in your inventory' : 'Update product details'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-1 py-6 pb-24 md:pb-6">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Basic Information</h3>

            <div>
              <label htmlFor="product-sku" className="text-sm font-medium">SKU *</label>
              <Input
                id="product-sku"
                {...register('sku')}
                placeholder="e.g., PROD-001"
                className={errors.sku ? 'border-red-500' : ''}
              />
              {errors.sku && <p className="text-xs text-red-500 mt-1">{errors.sku.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Must be unique. Will be stored in uppercase.</p>
            </div>

            <div>
              <label htmlFor="product-name" className="text-sm font-medium">Name *</label>
              <Input
                id="product-name"
                {...register('name')}
                placeholder="Product name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="product-description" className="text-sm font-medium">Description</label>
              <Textarea
                id="product-description"
                {...register('description')}
                placeholder="Product description"
                rows={4}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="product-category" className="text-sm font-medium">Category</label>
                <select
                  id="product-category"
                  {...register('categoryId')}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9"
                >
                  <option value="">No category</option>
                  {categories?.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="product-unit" className="text-sm font-medium">Unit *</label>
                <Input
                  id="product-unit"
                  {...register('unit')}
                  list="product-unit-presets"
                  placeholder="pcs"
                  value={watchUnit ?? ''}
                />
                <datalist id="product-unit-presets">
                  {UNIT_PRESETS.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
                {errors.unit && <p className="text-xs text-red-500 mt-1">{errors.unit.message}</p>}
              </div>
            </div>
          </div>

          {tenant?.customFields?.length ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Custom Fields</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {tenant.customFields.map((field) => {
                  const fieldValue = watchCustomFields?.[field.key];

                  return (
                    <div key={field._id}>
                      <label htmlFor={`product-custom-${field.key}`} className="text-sm font-medium">
                        {field.name}
                        {field.required ? ' *' : ''}
                      </label>

                      {field.type === 'boolean' ? (
                        <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
                          <input
                            id={`product-custom-${field.key}`}
                            type="checkbox"
                            checked={Boolean(fieldValue)}
                            onChange={(e) => setValue(`customFields.${field.key}`, e.target.checked)}
                          />
                          Enabled
                        </label>
                      ) : (
                        <Input
                          id={`product-custom-${field.key}`}
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          value={fieldValue === undefined || fieldValue === null ? '' : String(fieldValue)}
                          onChange={(e) => {
                            const value =
                              field.type === 'number'
                                ? (e.target.value === '' ? '' : Number(e.target.value))
                                : e.target.value;
                            setValue(`customFields.${field.key}`, value);
                          }}
                          placeholder={field.defaultValue || field.name}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {errors.customFields?.message ? (
                <p className="text-xs text-red-500">{String(errors.customFields.message)}</p>
              ) : null}
            </div>
          ) : null}

          {/* Pricing Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Pricing</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="product-cost-price" className="text-sm font-medium">Cost Price</label>
                <Input
                  id="product-cost-price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('costPrice')}
                  placeholder="0.00"
                  className={errors.costPrice ? 'border-red-500' : ''}
                />
                {errors.costPrice && <p className="text-xs text-red-500 mt-1">{errors.costPrice.message}</p>}
              </div>

              <div>
                <label htmlFor="product-selling-price" className="text-sm font-medium">Selling Price</label>
                <Input
                  id="product-selling-price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('sellingPrice')}
                  placeholder="0.00"
                  className={errors.sellingPrice ? 'border-red-500' : ''}
                />
                {errors.sellingPrice && <p className="text-xs text-red-500 mt-1">{errors.sellingPrice.message}</p>}
              </div>
            </div>

            {profitMargin !== null && (
              <p className={`text-sm font-medium ${profitMargin > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                Profit Margin: {profitMargin.toFixed(1)}%
              </p>
            )}
          </div>

          {/* Stock Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Stock Settings</h3>
            <div>
              <label htmlFor="product-low-stock-threshold" className="text-sm font-medium">Low Stock Threshold</label>
              <Input
                id="product-low-stock-threshold"
                type="number"
                min="0"
                step="1"
                {...register('lowStockThreshold')}
                placeholder="0"
                className={errors.lowStockThreshold ? 'border-red-500' : ''}
              />
              {errors.lowStockThreshold && <p className="text-xs text-red-500 mt-1">{errors.lowStockThreshold.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Alert when stock falls to or below this number</p>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Tags</h3>
            <div className="flex gap-2">
              <Input
                value={currentTag}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentTag(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag"
                aria-label="Add a tag"
              />
              <Button type="button" onClick={addTag} variant="outline" size="sm">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {watchTags.map((tag, idx) => (
                <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(idx)}
                    aria-label={`Remove tag ${tag}`}
                    className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Images */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Images</h3>
            <div className="flex gap-2">
              <Input
                value={currentImageUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentImageUrl(e.target.value)}
                placeholder="Enter image URL"
                aria-label="Image URL"
              />
              <Button type="button" onClick={addImage} variant="outline" size="sm">
                Add
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {watchImages.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={url}
                    alt={`Product ${idx}`}
                    className="w-full h-24 object-cover rounded-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"%3E%3Cpath stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/%3E%3C/svg%3E';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    aria-label={`Remove image ${idx + 1}`}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded transition md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="fixed bottom-0 left-0 right-0 flex gap-3 border-t bg-background p-4 md:static md:border-t md:bg-transparent md:px-0 md:pt-6">
            <Button type="button" variant="outline" onClick={onClose} className="h-11 min-h-11 flex-1 md:h-9 md:min-h-0">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="h-11 min-h-11 flex-1 md:h-9 md:min-h-0">
              {isLoading ? '...' : mode === 'create' ? 'Create Product' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
