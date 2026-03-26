import { format } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import type { CustomFieldType } from '@/types';

/**
 * Format a monetary amount using Intl.NumberFormat.
 * Never throws — returns fallback string on invalid input.
 */
export function formatCurrency(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale ?? undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const DATE_FORMAT_MAP: Record<string, string> = {
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
};

/**
 * Format a date according to tenant dateFormat setting.
 * Never throws — returns '—' on invalid input.
 */
export function formatDate(date: string | Date, dateFormat: string): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    const dfnsFormat = DATE_FORMAT_MAP[dateFormat] ?? 'MM/dd/yyyy';
    return format(d, dfnsFormat);
  } catch {
    return '—';
  }
}

/**
 * Format a date as relative time: "2 hours ago", "3 days ago", "just now".
 * Never throws.
 */
export function formatRelativeTime(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '—';
  }
}

/**
 * Extract the currency symbol from a currency code without hardcoding.
 * 'USD' → '$', 'EUR' → '€', 'PKR' → 'Rs', 'GBP' → '£'
 */
export function getCurrencySymbol(currency: string): string {
  try {
    const formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
    // Remove digits and common separators, trim whitespace
    return formatted.replace(/[\d,.\s]+/g, '').trim() || currency;
  } catch {
    return currency;
  }
}

/**
 * Format a custom field value to a display string.
 * Never throws — returns '—' for null/undefined/invalid.
 */
export function formatCustomFieldValue(
  value: unknown,
  type: CustomFieldType,
  tenantDateFormat = 'MM/DD/YYYY'
): string {
  if (value === null || value === undefined || value === '') return '—';

  try {
    switch (type) {
      case 'text':
        return String(value);
      case 'number':
        return Number(value).toLocaleString();
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
        return formatDate(value as string, tenantDateFormat);
      default:
        return String(value);
    }
  } catch {
    return '—';
  }
}

/**
 * Parse a raw string form input to the correct type before saving.
 */
export function parseCustomFieldValue(rawValue: string, type: CustomFieldType): unknown {
  switch (type) {
    case 'number':
      return parseFloat(rawValue);
    case 'boolean':
      return rawValue === 'true';
    case 'date':
      return new Date(rawValue).toISOString();
    case 'text':
    default:
      return rawValue.trim();
  }
}
