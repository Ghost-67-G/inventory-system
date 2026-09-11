import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompleteStep2 } from '@/hooks/useOnboarding';
import type { OnboardingStatus } from '@/types';

const schema = z.object({
  warehouseName: z.string().trim().min(1, 'Warehouse name is required').max(100),
  warehouseCode: z.string().trim().max(20).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  country: z.string().trim().max(100).optional().or(z.literal(''))
});

type FormValues = z.infer<typeof schema>;

interface StepTwoProps {
  status?: OnboardingStatus;
  onNext: () => void;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? 'Could not create the warehouse.';
  }
  return 'Could not create the warehouse.';
}

export function StepTwo({ status, onNext }: StepTwoProps) {
  const completeStepTwo = useCompleteStep2();
  const [showLocation, setShowLocation] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      warehouseName: '',
      warehouseCode: '',
      city: '',
      country: ''
    }
  });

  const warehouseCodeField = register('warehouseCode');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await completeStepTwo.mutateAsync({
        warehouseName: values.warehouseName,
        warehouseCode: values.warehouseCode || undefined,
        city: values.city || undefined,
        country: values.country || undefined
      });
    } catch {
      // Error is rendered below via the mutation state.
      return;
    }
    onNext();
  });

  if (status?.hasWarehouse) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Where do you store your inventory?</h1>
          <p className="text-sm text-muted-foreground">Add your first warehouse or storage location.</p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            <span>Warehouse already created</span>
          </div>
          <p className="mt-1 text-emerald-700 dark:text-emerald-400">{status.warehouseName ?? 'Your first warehouse is ready.'}</p>
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
        <h1 className="text-2xl font-semibold text-foreground">Where do you store your inventory?</h1>
        <p className="text-sm text-muted-foreground">Add your first warehouse or storage location.</p>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <svg viewBox="0 0 240 120" className="h-30 w-full" role="img" aria-label="Warehouse illustration">
          <path d="M20 52 L120 16 L220 52" fill="none" stroke="currentColor" className="text-muted-foreground" strokeWidth="2" />
          <rect x="32" y="52" width="176" height="50" fill="currentColor" className="text-muted" stroke="currentColor" strokeWidth="2" />
          <rect x="104" y="72" width="32" height="30" fill="currentColor" className="text-border" stroke="currentColor" strokeWidth="2" />
          <rect x="54" y="66" width="20" height="12" fill="none" stroke="currentColor" className="text-muted-foreground" strokeWidth="2" />
          <rect x="166" y="66" width="20" height="12" fill="none" stroke="currentColor" className="text-muted-foreground" strokeWidth="2" />
        </svg>
      </div>

      <div>
        <label htmlFor="onb-warehouse-name" className="mb-1 block text-sm font-medium text-foreground">Warehouse name</label>
        <Input id="onb-warehouse-name" placeholder="e.g. Main Warehouse, North Storage, Workshop" {...register('warehouseName')} />
        {errors.warehouseName ? <p className="mt-1 text-xs text-red-600">{errors.warehouseName.message}</p> : null}
      </div>

      <div>
        <label htmlFor="onb-warehouse-code" className="mb-1 block text-sm font-medium text-foreground">Short code</label>
        <Input
          id="onb-warehouse-code"
          aria-describedby="onb-warehouse-code-hint"
          placeholder="e.g. WH-001, MAIN, NORTH"
          {...warehouseCodeField}
          onBlur={(event) => {
            // Overriding onBlur previously dropped react-hook-form's own blur handler.
            void warehouseCodeField.onBlur(event);
            setValue('warehouseCode', event.currentTarget.value.toUpperCase(), { shouldValidate: true });
          }}
        />
        <p id="onb-warehouse-code-hint" className="mt-1 text-xs text-muted-foreground">Used as a quick identifier. Auto-generated if left blank.</p>
        {errors.warehouseCode ? <p className="mt-1 text-xs text-red-600">{errors.warehouseCode.message}</p> : null}
      </div>

      <button
        type="button"
        aria-expanded={showLocation}
        aria-controls="onb-location-fields"
        onClick={() => setShowLocation((prev) => !prev)}
        className="flex items-center gap-2 text-sm font-medium text-foreground"
      >
        <ChevronDown size={16} aria-hidden="true" className={showLocation ? 'rotate-180 transition-transform' : 'transition-transform'} />
        Add location details (optional)
      </button>

      {showLocation ? (
        <div id="onb-location-fields" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="onb-city" className="mb-1 block text-sm font-medium text-foreground">City</label>
            <Input id="onb-city" autoComplete="address-level2" placeholder="City" {...register('city')} />
            {errors.city ? <p className="mt-1 text-xs text-red-600">{errors.city.message}</p> : null}
          </div>
          <div>
            <label htmlFor="onb-country" className="mb-1 block text-sm font-medium text-foreground">Country</label>
            <Input id="onb-country" autoComplete="country-name" placeholder="Country" {...register('country')} />
            {errors.country ? <p className="mt-1 text-xs text-red-600">{errors.country.message}</p> : null}
          </div>
        </div>
      ) : null}

      {completeStepTwo.isError ? (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {getErrorMessage(completeStepTwo.error)}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={completeStepTwo.isPending}>
        {completeStepTwo.isPending ? 'Creating...' : 'Add warehouse →'}
      </Button>

      <button type="button" onClick={onNext} disabled={completeStepTwo.isPending} className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50">
        I&apos;ll add this later →
      </button>
      <p className="text-center text-xs text-muted-foreground">You&apos;ll need at least one warehouse before recording stock</p>
    </form>
  );
}
