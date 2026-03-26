import { useTenantStore } from '@/store/tenantStore';
import {
  formatCurrency,
  formatCustomFieldValue,
  formatDate,
  formatRelativeTime,
} from '@/lib/formatting';
import type { CustomFieldType } from '@/types';

export function useTenantFormatting() {
  const tenant = useTenantStore((state) => state.tenant);

  return {
    formatMoney: (amount: number) =>
      formatCurrency(amount, tenant?.settings.currency ?? 'USD'),

    formatDate: (date: string | Date) =>
      formatDate(date, tenant?.settings.dateFormat ?? 'MM/DD/YYYY'),

    formatRelativeTime,

    formatCustomFieldValue: (value: unknown, type: CustomFieldType) =>
      formatCustomFieldValue(value, type, tenant?.settings.dateFormat ?? 'MM/DD/YYYY'),

    currency: tenant?.settings.currency ?? 'USD',
    timezone: tenant?.settings.timezone ?? 'UTC',
    dateFormat: tenant?.settings.dateFormat ?? 'MM/DD/YYYY',
    measurementUnit: tenant?.settings.measurementUnit ?? 'metric',
    lowStockThreshold: tenant?.settings.lowStockThreshold ?? 10,
  };
}
