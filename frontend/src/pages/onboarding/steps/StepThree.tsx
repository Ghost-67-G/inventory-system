import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompleteStep3 } from '@/hooks/useOnboarding';
import { useTenantStore } from '@/store/tenantStore';
import type { OnboardingStatus } from '@/types';

const UNIT_PRESETS = ['pcs', 'kg', 'ltr', 'box', 'carton'] as const;
const COLOR_SWATCHES = ['#6366f1', '#10b981', '#06b6d4', '#f97316', '#ef4444', '#64748b'] as const;

const schema = z.object({
  categoryName: z.string().trim().min(1, 'Category name is required').max(100),
  categoryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  productName: z.string().trim().min(1, 'Product name is required').max(200),
  productSku: z.string().trim().min(1, 'SKU is required').max(100),
  productUnit: z.string().trim().min(1, 'Unit is required').max(50),
  productSellingPrice: z.coerce.number().min(0),
  productCostPrice: z.coerce.number().min(0)
});

type FormValues = z.infer<typeof schema>;

interface StepThreeProps {
  status?: OnboardingStatus;
  onNext: () => void;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? 'Could not create the product.';
  }
  return 'Could not create the product.';
}

export function StepThree({ status, onNext }: StepThreeProps) {
  const completeStep3 = useCompleteStep3();
  const tenant = useTenantStore((state) => state.tenant);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryName: '',
      categoryColor: '#6366f1',
      productName: '',
      productSku: '',
      productUnit: 'pcs',
      productSellingPrice: 0,
      productCostPrice: 0
    }
  });

  // Native number inputs report strings until zod coerces on submit, so
  // normalise here before doing arithmetic.
  const costPrice = Number(watch('productCostPrice')) || 0;
  const sellingPrice = Number(watch('productSellingPrice')) || 0;
  const selectedColor = watch('categoryColor');
  const selectedUnit = watch('productUnit');

  const margin = useMemo(() => {
    if (!sellingPrice || sellingPrice <= 0) {
      return 0;
    }
    return ((sellingPrice - costPrice) / sellingPrice) * 100;
  }, [costPrice, sellingPrice]);

  const currencySymbol = useMemo(() => {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: tenant?.settings.currency ?? 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });

    return formatter.formatToParts(0).find((part) => part.type === 'currency')?.value ?? '$';
  }, [tenant?.settings.currency]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await completeStep3.mutateAsync({
        categoryName: values.categoryName,
        categoryColor: values.categoryColor,
        productName: values.productName,
        productSku: values.productSku,
        productUnit: values.productUnit,
        productSellingPrice: values.productSellingPrice,
        productCostPrice: values.productCostPrice
      });
    } catch {
      // Error is rendered below via the mutation state.
      return;
    }

    onNext();
  });

  if (status?.hasProduct) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Add your first product</h1>
          <p className="text-sm text-muted-foreground">Start with one product. You can add more from the Products page.</p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>First product already created</span>
          </div>
          <p className="mt-1 text-emerald-700 dark:text-emerald-400">{status.productName ?? 'You already have product data in place.'}</p>
        </div>

        <Button type="button" className="w-full" onClick={onNext}>
          Continue →
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Add your first product</h1>
        <p className="text-sm text-muted-foreground">Start with one product. You can add more from the Products page.</p>
      </div>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Product category</p>
          <p className="text-xs text-muted-foreground">Categories help you organise products. Create one now.</p>
        </div>

        <div>
          <label htmlFor="onb-category-name" className="mb-1 block text-sm font-medium text-foreground">Category name</label>
          <Input id="onb-category-name" placeholder="e.g. Electronics, Clothing, Raw Materials" {...register('categoryName')} />
          {errors.categoryName ? <p className="mt-1 text-xs text-red-600">{errors.categoryName.message}</p> : null}
        </div>

        <div>
          <p id="onb-category-color-label" className="mb-1 block text-sm font-medium text-foreground">Category color</p>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="onb-category-color-label">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-pressed={selectedColor === swatch}
                onClick={() => setValue('categoryColor', swatch, { shouldValidate: true })}
                className={`h-6 w-6 rounded-full border border-border ${
                  selectedColor === swatch ? 'ring-2 ring-ring ring-offset-2 ring-offset-card' : ''
                }`}
                style={{ backgroundColor: swatch }}
                aria-label={`Select ${swatch}`}
              />
            ))}
          </div>
          {errors.categoryColor ? <p className="mt-1 text-xs text-red-600">{errors.categoryColor.message}</p> : null}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">Product information</p>

        <div>
          <label htmlFor="onb-product-name" className="mb-1 block text-sm font-medium text-foreground">Product name</label>
          <Input id="onb-product-name" placeholder="Product name" {...register('productName')} />
          {errors.productName ? <p className="mt-1 text-xs text-red-600">{errors.productName.message}</p> : null}
        </div>

        <div>
          <label htmlFor="onb-product-sku" className="mb-1 block text-sm font-medium text-foreground">SKU</label>
          <Input id="onb-product-sku" aria-describedby="onb-product-sku-hint" placeholder="e.g. PROD-001" {...register('productSku')} />
          <p id="onb-product-sku-hint" className="mt-1 text-xs text-muted-foreground">Unique code for this product. Will be stored in uppercase.</p>
          {errors.productSku ? <p className="mt-1 text-xs text-red-600">{errors.productSku.message}</p> : null}
        </div>

        <div>
          <label htmlFor="onb-product-unit" className="mb-1 block text-sm font-medium text-foreground">Unit</label>
          <Input id="onb-product-unit" placeholder="pcs" {...register('productUnit')} />
          <div className="mt-2 flex flex-wrap gap-2">
            {UNIT_PRESETS.map((unit) => (
              <button
                key={unit}
                type="button"
                aria-pressed={selectedUnit === unit}
                onClick={() => setValue('productUnit', unit, { shouldValidate: true })}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selectedUnit === unit ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
          {errors.productUnit ? <p className="mt-1 text-xs text-red-600">{errors.productUnit.message}</p> : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="onb-cost-price" className="mb-1 block text-sm font-medium text-foreground">Cost price</label>
            <div className="flex items-center rounded-md border border-input bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="text-sm text-muted-foreground" aria-hidden="true">{currencySymbol}</span>
              <input
                id="onb-cost-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="min-w-0 w-full border-0 bg-transparent py-2 pl-2 text-sm text-foreground outline-none"
                {...register('productCostPrice')}
              />
            </div>
            {errors.productCostPrice ? <p className="mt-1 text-xs text-red-600">{errors.productCostPrice.message}</p> : null}
          </div>

          <div>
            <label htmlFor="onb-selling-price" className="mb-1 block text-sm font-medium text-foreground">Selling price</label>
            <div className="flex items-center rounded-md border border-input bg-background px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="text-sm text-muted-foreground" aria-hidden="true">{currencySymbol}</span>
              <input
                id="onb-selling-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="min-w-0 w-full border-0 bg-transparent py-2 pl-2 text-sm text-foreground outline-none"
                {...register('productSellingPrice')}
              />
            </div>
            {errors.productSellingPrice ? <p className="mt-1 text-xs text-red-600">{errors.productSellingPrice.message}</p> : null}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Margin: {Number.isFinite(margin) ? `${margin.toFixed(1)}%` : '0%'}</p>
      </section>

      {completeStep3.isError ? (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {getErrorMessage(completeStep3.error)}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={completeStep3.isPending}>
        {completeStep3.isPending ? 'Creating...' : 'Add product →'}
      </Button>

      <button type="button" onClick={onNext} disabled={completeStep3.isPending} className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50">
        I&apos;ll add products later →
      </button>
    </form>
  );
}
