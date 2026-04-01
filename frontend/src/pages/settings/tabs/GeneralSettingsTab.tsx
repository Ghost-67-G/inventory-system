import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useTenantStore } from '@/store/tenantStore';
import { useUpdateGeneralSettings } from '@/hooks/useSettings';
import { SUPPORTED_CURRENCIES, type TenantSettings, type UpdateGeneralSettingsDto } from '@/types';
import { getCurrencySymbol } from '@/lib/formatting';

const schema = z.object({
  name: z.string().min(2).max(100).trim(),
  currency: z.string().min(3).max(3),
  timezone: z.string().min(1),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000),
  measurementUnit: z.enum(['metric', 'imperial'] as const),
});

type FormValues = z.infer<typeof schema>;

function coerceDateFormat(value: string | undefined): FormValues['dateFormat'] {
  if (value === 'DD/MM/YYYY' || value === 'YYYY-MM-DD') return value;
  return 'MM/DD/YYYY';
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const TIMEZONE_GROUPS = ['Africa', 'America', 'Asia', 'Atlantic', 'Australia', 'Europe', 'Pacific', 'UTC'] as const;

function listTimezones() {
  if ('supportedValuesOf' in Intl && typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('timeZone');
  }
  return ['UTC'];
}

function formatDatePreview(dateFormat: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (dateFormat === 'DD/MM/YYYY') return `${dd}/${mm}/${yyyy}`;
  if (dateFormat === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
  return `${mm}/${dd}/${yyyy}`;
}

function getCurrentTimeInTimezone(tz: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return 'Invalid timezone';
  }
}

interface GeneralSettingsTabProps {
  canManage: boolean;
}

export function GeneralSettingsTab({ canManage }: GeneralSettingsTabProps) {
  const tenant = useTenantStore((s) => s.tenant);
  const { mutate, isPending, error } = useUpdateGeneralSettings();
  const [clock, setClock] = useState(() => new Date());

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: tenant?.name ?? '',
      currency: tenant?.settings.currency ?? 'USD',
      timezone: tenant?.settings.timezone ?? 'UTC',
      dateFormat: coerceDateFormat(tenant?.settings.dateFormat),
      lowStockThreshold: tenant?.settings.lowStockThreshold ?? 10,
      measurementUnit: tenant?.settings.measurementUnit ?? 'metric',
    },
  });

  useEffect(() => {
    form.reset({
      name: tenant?.name ?? '',
      currency: tenant?.settings.currency ?? 'USD',
      timezone: tenant?.settings.timezone ?? 'UTC',
      dateFormat: coerceDateFormat(tenant?.settings.dateFormat),
      lowStockThreshold: tenant?.settings.lowStockThreshold ?? 10,
      measurementUnit: tenant?.settings.measurementUnit ?? 'metric',
    });
  }, [tenant, form]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const name = form.watch('name');
  const currency = form.watch('currency');
  const timezone = form.watch('timezone');
  const dateFormat = form.watch('dateFormat');

  const slugPreview = useMemo(() => slugify(name || tenant?.name || ''), [name, tenant?.name]);

  const groupedTimezones = useMemo(() => {
    const zones = listTimezones();
    return TIMEZONE_GROUPS.map((group) => ({
      group,
      zones: zones.filter((z) => group === 'UTC' ? z === 'UTC' : z.startsWith(`${group}/`)),
    })).filter((g) => g.zones.length > 0);
  }, []);

  const onSubmit = (values: FormValues) => {
    if (!canManage) return;

    const settings: TenantSettings = {
      currency: values.currency,
      timezone: values.timezone,
      dateFormat: values.dateFormat,
      lowStockThreshold: values.lowStockThreshold,
      measurementUnit: values.measurementUnit,
    };

    const payload: UpdateGeneralSettingsDto = {
      name: values.name,
      settings,
    };

    mutate(payload);
  };

  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (axios.isAxiosError(error)) {
      return (error.response?.data as { message?: string } | undefined)?.message ?? 'Failed to save settings';
    }
    return 'Failed to save settings';
  }, [error]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold text-foreground">Business Information</h3>
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-foreground">Business name</label>
          <input
            {...form.register('name')}
            disabled={!canManage}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Your workspace URL: <span className="font-mono">app.yourdomain.com/{slugPreview}</span>
          </p>
          {form.formState.errors.name && (
            <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold text-foreground">Regional Settings</h3>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Currency</label>
            <select
              {...form.register('currency')}
              disabled={!canManage}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Prices will display as: {getCurrencySymbol(currency)}1,234.56
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Timezone</label>
            <select
              {...form.register('timezone')}
              disabled={!canManage}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted"
            >
              {groupedTimezones.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Current time: {getCurrentTimeInTimezone(timezone || 'UTC', clock)}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Date format</label>
            <select
              {...form.register('dateFormat')}
              disabled={!canManage}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Example: {formatDatePreview(dateFormat)}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Low stock threshold</label>
            <input
              {...form.register('lowStockThreshold')}
              type="number"
              min={0}
              max={100000}
              disabled={!canManage}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Products with stock at or below this number will trigger low stock alerts.
              Individual products can override this threshold.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-foreground">Measurement unit</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-border p-3 has-checked:border-blue-500 has-checked:bg-blue-50 dark:has-checked:bg-blue-900/20">
              <input
                type="radio"
                value="metric"
                {...form.register('measurementUnit')}
                disabled={!canManage}
                className="accent-blue-600"
              />
              <span className="text-sm text-foreground">Metric (kg, ltr, cm)</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border p-3 has-checked:border-blue-500 has-checked:bg-blue-50 dark:has-checked:bg-blue-900/20">
              <input
                type="radio"
                value="imperial"
                {...form.register('measurementUnit')}
                disabled={!canManage}
                className="accent-blue-600"
              />
              <span className="text-sm text-foreground">Imperial (lb, fl oz, in)</span>
            </label>
          </div>
        </div>
      </section>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {canManage ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
