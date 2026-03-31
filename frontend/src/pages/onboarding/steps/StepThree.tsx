import { zodResolver } from '@hookform/resolvers/zod';
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

  const costPrice = watch('productCostPrice');
  const sellingPrice = watch('productSellingPrice');

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
    await completeStep3.mutateAsync({
      categoryName: values.categoryName,
      categoryColor: values.categoryColor,
      productName: values.productName,
      productSku: values.productSku,
      productUnit: values.productUnit,
      productSellingPrice: values.productSellingPrice,
      productCostPrice: values.productCostPrice
    });

    onNext();
  });

  if (status?.hasProduct) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Add your first product</h1>
          <p className="text-sm text-slate-600">Start with one product. You can add more from the Products page.</p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            <span>First product already created</span>
          </div>
          <p className="mt-1 text-emerald-700">{status.productName ?? 'You already have product data in place.'}</p>
        </div>

        <Button className="w-full" onClick={onNext}>
          Continue →
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Add your first product</h1>
        <p className="text-sm text-slate-600">Start with one product. You can add more from the Products page.</p>
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div>
          <p className="text-sm font-medium text-slate-800">Product category</p>
          <p className="text-xs text-slate-500">Categories help you organise products. Create one now.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Category name</label>
          <Input placeholder="e.g. Electronics, Clothing, Raw Materials" {...register('categoryName')} />
          {errors.categoryName ? <p className="mt-1 text-xs text-red-600">{errors.categoryName.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Category color</label>
          <div className="flex items-center gap-2">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setValue('categoryColor', swatch, { shouldValidate: true })}
                className="h-6 w-6 rounded-full border border-slate-300"
                style={{ backgroundColor: swatch }}
                aria-label={`Select ${swatch}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-800">Product information</p>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Product name</label>
          <Input placeholder="Product name" {...register('productName')} />
          {errors.productName ? <p className="mt-1 text-xs text-red-600">{errors.productName.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">SKU</label>
          <Input placeholder="e.g. PROD-001" {...register('productSku')} />
          <p className="mt-1 text-xs text-slate-500">Unique code for this product. Will be stored in uppercase.</p>
          {errors.productSku ? <p className="mt-1 text-xs text-red-600">{errors.productSku.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Unit</label>
          <Input placeholder="pcs" {...register('productUnit')} />
          <div className="mt-2 flex flex-wrap gap-2">
            {UNIT_PRESETS.map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => setValue('productUnit', unit, { shouldValidate: true })}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700"
              >
                {unit}
              </button>
            ))}
          </div>
          {errors.productUnit ? <p className="mt-1 text-xs text-red-600">{errors.productUnit.message}</p> : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Cost price</label>
            <div className="flex items-center rounded-md border border-slate-300 px-3">
              <span className="text-sm text-slate-500">{currencySymbol}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full border-0 py-2 pl-2 text-sm outline-none"
                {...register('productCostPrice')}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Selling price</label>
            <div className="flex items-center rounded-md border border-slate-300 px-3">
              <span className="text-sm text-slate-500">{currencySymbol}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full border-0 py-2 pl-2 text-sm outline-none"
                {...register('productSellingPrice')}
              />
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-600">Margin: {Number.isFinite(margin) ? `${margin.toFixed(1)}%` : '0%'}</p>
      </section>

      <Button type="submit" className="w-full" disabled={completeStep3.isPending}>
        {completeStep3.isPending ? 'Creating...' : 'Add product →'}
      </Button>

      <button type="button" onClick={onNext} className="w-full text-sm text-slate-600 underline-offset-4 hover:underline">
        I&apos;ll add products later →
      </button>
    </form>
  );
}
