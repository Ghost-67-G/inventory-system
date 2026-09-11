import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompleteStep1 } from '@/hooks/useOnboarding';
import type { OnboardingStatus } from '@/types';

const schema = z.object({
  businessName: z.string().trim().min(2, 'Business name must be at least 2 characters').max(100),
  currency: z.enum(['USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'CAD', 'AUD', 'SGD']),
  timezone: z.string().min(1, 'Timezone is required'),
  lowStockThreshold: z.coerce.number().int().min(0).max(10000)
});

type FormValues = z.infer<typeof schema>;

const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'US Dollar', symbol: '$', flag: 'US' },
  { code: 'EUR', label: 'Euro', symbol: '€', flag: 'EU' },
  { code: 'GBP', label: 'British Pound', symbol: '£', flag: 'GB' },
  { code: 'PKR', label: 'Pakistani Rupee', symbol: 'Rs', flag: 'PK' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', flag: 'IN' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'AED', flag: 'AE' },
  { code: 'SAR', label: 'Saudi Riyal', symbol: 'SAR', flag: 'SA' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$', flag: 'CA' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$', flag: 'AU' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$', flag: 'SG' }
] as const;

const TIMEZONE_GROUPS = {
  Americas: [
    { value: 'America/New_York', label: 'Eastern Time (UTC-5)' },
    { value: 'America/Chicago', label: 'Central Time (UTC-6)' },
    { value: 'America/Denver', label: 'Mountain Time (UTC-7)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8)' },
    { value: 'America/Toronto', label: 'Toronto (UTC-5)' }
  ],
  Europe: [
    { value: 'Europe/London', label: 'London (UTC+0)' },
    { value: 'Europe/Paris', label: 'Paris (UTC+1)' },
    { value: 'Europe/Berlin', label: 'Berlin (UTC+1)' }
  ],
  'Asia & Middle East': [
    { value: 'Asia/Karachi', label: 'Karachi (UTC+5)' },
    { value: 'Asia/Kolkata', label: 'India (UTC+5:30)' },
    { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
    { value: 'Asia/Riyadh', label: 'Riyadh (UTC+3)' },
    { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' }
  ],
  Pacific: [
    { value: 'Australia/Sydney', label: 'Sydney (UTC+10)' },
    { value: 'Pacific/Auckland', label: 'Auckland (UTC+12)' }
  ]
} as const;

function toFlag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

interface StepOneProps {
  status?: OnboardingStatus;
  onNext: () => void;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? 'Could not save your business details.';
  }
  return 'Could not save your business details.';
}

export function StepOne({ status, onNext }: StepOneProps) {
  const completeStepOne = useCompleteStep1();

  const detectedTimezone = useMemo(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const allTimezones: string[] = Object.values(TIMEZONE_GROUPS).flat().map((tz) => tz.value);
    return allTimezones.includes(browserTz) ? browserTz : 'America/New_York';
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: status?.tenant.name ?? '',
      currency: (status?.tenant.currency as FormValues['currency']) ?? 'USD',
      timezone: status?.tenant.timezone ?? detectedTimezone,
      lowStockThreshold: status?.tenant.lowStockThreshold ?? 10
    }
  });

  useEffect(() => {
    if (!status) {
      return;
    }

    reset({
      businessName: status.tenant.name,
      currency: (status.tenant.currency as FormValues['currency']) ?? 'USD',
      timezone: status.tenant.timezone || detectedTimezone,
      lowStockThreshold: status.tenant.lowStockThreshold ?? 10
    });
  }, [status, reset, detectedTimezone]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await completeStepOne.mutateAsync(values);
    } catch {
      // Error is rendered below via the mutation state.
      return;
    }
    onNext();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Let&apos;s set up your business</h1>
        <p className="text-sm text-muted-foreground">This takes less than 2 minutes. You can change these later.</p>
      </div>

      <div>
        <label htmlFor="onb-business-name" className="mb-1 block text-sm font-medium text-foreground">Business name</label>
        <Input id="onb-business-name" autoComplete="organization" placeholder="e.g. Apex Electronics, Crescent Wholesale" {...register('businessName')} className="h-11 md:h-9" />
        {errors.businessName ? <p className="mt-1 text-xs text-red-600">{errors.businessName.message}</p> : null}
      </div>

      <div>
        <label htmlFor="onb-currency" className="mb-1 block text-sm font-medium text-foreground">Currency</label>
        <select id="onb-currency" className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9" {...register('currency')}>
          {CURRENCY_OPTIONS.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {toFlag(currency.flag)} {currency.label} ({currency.code}) {currency.symbol}
            </option>
          ))}
        </select>
        {errors.currency ? <p className="mt-1 text-xs text-red-600">{errors.currency.message}</p> : null}
      </div>

      <div>
        <label htmlFor="onb-timezone" className="mb-1 block text-sm font-medium text-foreground">Timezone</label>
        <select id="onb-timezone" className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9" {...register('timezone')}>
          {Object.entries(TIMEZONE_GROUPS).map(([group, options]) => (
            <optgroup key={group} label={group}>
              {options.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {errors.timezone ? <p className="mt-1 text-xs text-red-600">{errors.timezone.message}</p> : null}
      </div>

      <div>
        <label htmlFor="onb-low-stock" className="mb-1 block text-sm font-medium text-foreground">Default low stock alert</label>
        <p id="onb-low-stock-hint" className="mb-2 text-xs text-muted-foreground">Alert me when any product drops to or below this quantity</p>
        <div className="flex items-center gap-2">
          <Input id="onb-low-stock" aria-describedby="onb-low-stock-hint" type="number" inputMode="numeric" min={0} max={10000} {...register('lowStockThreshold')} className="h-11 md:h-9" />
          <span className="text-sm text-muted-foreground">units</span>
        </div>
        {errors.lowStockThreshold ? (
          <p className="mt-1 text-xs text-red-600">{errors.lowStockThreshold.message}</p>
        ) : null}
      </div>

      {completeStepOne.isError ? (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {getErrorMessage(completeStepOne.error)}
        </p>
      ) : null}

      <Button type="submit" className="h-11 min-h-11 w-full md:h-9 md:min-h-0" disabled={completeStepOne.isPending}>
        {completeStepOne.isPending ? 'Saving...' : 'Save and continue →'}
      </Button>
    </form>
  );
}
