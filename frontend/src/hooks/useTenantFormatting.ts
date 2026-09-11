import { useCallback, useMemo } from 'react';
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

  const currency = tenant?.settings.currency ?? 'USD';
  const dateFormat = tenant?.settings.dateFormat ?? 'MM/DD/YYYY';
  const timezone = tenant?.settings.timezone ?? 'UTC';
  const measurementUnit = tenant?.settings.measurementUnit ?? 'metric';
  const lowStockThreshold = tenant?.settings.lowStockThreshold ?? 10;

  // Stable references: pages memoize table columns on these helpers, so fresh
  // closures every render would rebuild every column definition each time.
  const formatMoney = useCallback((amount: number) => formatCurrency(amount, currency), [currency]);
  const formatDateFn = useCallback((date: string | Date) => formatDate(date, dateFormat), [dateFormat]);
  const formatCustomFieldValueFn = useCallback(
    (value: unknown, type: CustomFieldType) => formatCustomFieldValue(value, type, dateFormat),
    [dateFormat]
  );

  return useMemo(
    () => ({
      formatMoney,
      formatDate: formatDateFn,
      formatRelativeTime,
      formatCustomFieldValue: formatCustomFieldValueFn,
      currency,
      timezone,
      dateFormat,
      measurementUnit,
      lowStockThreshold,
    }),
    [formatMoney, formatDateFn, formatCustomFieldValueFn, currency, timezone, dateFormat, measurementUnit, lowStockThreshold]
  );
}
