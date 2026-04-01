import { useState, useEffect, useMemo } from 'react';
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
  const [profitMargin, setProfitMargin] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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

  // Calculate profit margin
  useEffect(() => {
    if (sellingPrice && costPrice >= 0) {
      if (sellingPrice > 0) {
        const margin = ((sellingPrice - costPrice) / sellingPrice) * 100;
        setProfitMargin(Number.isFinite(margin) ? margin : null);
      } else {
        setProfitMargin(null);
      }
    }
  }, [costPrice, sellingPrice]);

  // Pre-fill form in edit mode
  useEffect(() => {
    if (mode === 'edit' && product && open) {
      reset({
        sku: product.sku,
        name: product.name,
        description: product.description,
        categoryId: product.categoryId ?? null,
        unit: product.unit,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        lowStockThreshold: product.lowStockThreshold,
        images: product.images,
        tags: product.tags,
        customFields: product.customFields ?? {}
      });
    } else if (mode === 'create' && open) {
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
  }, [mode, open, product, reset, defaultCustomFields]);

  const onSubmit = async (data: FormData) => {
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
    if (currentImageUrl && watchImages.length < 10) {
      setValue('images', [...watchImages, currentImageUrl]);
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
      <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'h-[90vh] w-full overflow-y-auto' : 'w-full max-w-2xl overflow-y-auto'}>
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
              <label className="text-sm font-medium">SKU *</label>
              <Input
                {...register('sku')}
                placeholder="e.g., PROD-001"
                className={errors.sku ? 'border-red-500' : ''}
              />
              {errors.sku && <p className="text-xs text-red-500 mt-1">{errors.sku.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Must be unique. Will be stored in uppercase.</p>
            </div>

            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                {...register('name')}
                placeholder="Product name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                {...register('description')}
                placeholder="Product description"
                rows={4}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <select {...register('categoryId')} className="h-11 w-full rounded-md border px-3 py-2 text-sm md:h-9">
                  <option value="">No category</option>
                  {categories?.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Unit *</label>
                <Input
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
                      <label className="text-sm font-medium">
                        {field.name}
                        {field.required ? ' *' : ''}
                      </label>

                      {field.type === 'boolean' ? (
                        <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={Boolean(fieldValue)}
                            onChange={(e) => setValue(`customFields.${field.key}`, e.target.checked)}
                          />
                          Enabled
                        </label>
                      ) : (
                        <Input
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
            </div>
          ) : null}

          {/* Pricing Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Pricing</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cost Price</label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('costPrice')}
                  placeholder="0.00"
                  className={errors.costPrice ? 'border-red-500' : ''}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Selling Price</label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('sellingPrice')}
                  placeholder="0.00"
                  className={errors.sellingPrice ? 'border-red-500' : ''}
                />
              </div>
            </div>

            {profitMargin !== null && (
              <p className={`text-sm font-medium ${profitMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                Profit Margin: {profitMargin.toFixed(1)}%
              </p>
            )}
          </div>

          {/* Stock Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Stock Settings</h3>
            <div>
              <label className="text-sm font-medium">Low Stock Threshold</label>
              <Input
                type="number"
                {...register('lowStockThreshold')}
                placeholder="0"
                className={errors.lowStockThreshold ? 'border-red-500' : ''}
              />
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
              />
              <Button type="button" onClick={addTag} variant="outline" size="sm">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {watchTags.map((tag, idx) => (
                <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(idx)}
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
              />
              <Button type="button" onClick={addImage} variant="outline" size="sm">
                Add
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
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
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
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
