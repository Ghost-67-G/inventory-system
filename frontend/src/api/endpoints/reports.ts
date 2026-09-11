import client from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import type {
  StockValuationRow,
  StockValuationSummary,
  StockValuationParams,
  LowStockRow,
  LowStockSummary,
  LowStockParams,
  MovementsReportParams,
  IStockMovement,
  WasteAdjustmentSummary,
  WasteAdjustmentsParams
} from '@/types';

/**
 * Helper: Trigger browser download from streaming endpoint
 * Uses fetch with Authorization header since plain <a href> cannot send auth
 */
const triggerDownload = async (url: string, token: string | null): Promise<void> => {
  try {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = extractFilename(response.headers.get('Content-Disposition') ?? '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking synchronously can abort the download in Firefox/Safari.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
};

/**
 * Helper: Extract filename from Content-Disposition header
 */
const extractFilename = (header: string): string => {
  // RFC 5987 form (filename*=UTF-8''name.csv) takes precedence when present.
  const extended = header.match(/filename\*=(?:UTF-8'')?"?([^";]+)"?/i);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1]);
    } catch {
      return extended[1];
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() || 'export.csv';
};

/**
 * Build query string without undefined/null/empty values.
 */
const buildQueryString = (params?: Record<string, unknown>): string => {
  if (!params) return '';

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });

  return query.toString();
};

export const reportsApi = {
  // Stock Valuation Report — JSON with pagination
  getStockValuation: (params?: StockValuationParams) =>
    client.get<{
      success: boolean;
      data: {
        rows: StockValuationRow[];
        nextCursor: string | null;
        hasMore: boolean;
        summary?: StockValuationSummary;
        generatedAt: string;
      };
    }>('/reports/stock-valuation', { params }),

  // Stock Valuation Report — CSV export
  exportStockValuation: (params?: StockValuationParams): Promise<void> => {
    const query = buildQueryString(params as Record<string, unknown> | undefined);
    const token = useAuthStore.getState().accessToken;
    const url = `${import.meta.env.VITE_API_URL}/reports/stock-valuation/export${query ? `?${query}` : ''}`;
    return triggerDownload(url, token);
  },

  // Stock Movements Report — JSON preview with cursor pagination
  getMovements: (params?: MovementsReportParams) =>
    client.get<{
      success: boolean;
      data: {
        movements: IStockMovement[];
        nextCursor: string | null;
        hasMore: boolean;
        summary: Array<{ _id: string; count: number; totalQuantity: number }>;
        generatedAt: string;
      };
    }>('/reports/movements', { params }),

  // Stock Movements Report — CSV export
  exportMovements: (params?: MovementsReportParams): Promise<void> => {
    const query = buildQueryString(params as Record<string, unknown> | undefined);
    const token = useAuthStore.getState().accessToken;
    const url = `${import.meta.env.VITE_API_URL}/reports/movements/export${query ? `?${query}` : ''}`;
    return triggerDownload(url, token);
  },

  // Low Stock Report — JSON with cursor pagination
  getLowStock: (params?: LowStockParams) =>
    client.get<{
      success: boolean;
      data: {
        rows: LowStockRow[];
        nextCursor: string | null;
        hasMore: boolean;
        summary?: LowStockSummary;
        generatedAt: string;
      };
    }>('/reports/low-stock', { params }),

  // Low Stock Report — CSV export
  exportLowStock: (params?: LowStockParams): Promise<void> => {
    const query = buildQueryString(params as Record<string, unknown> | undefined);
    const token = useAuthStore.getState().accessToken;
    const url = `${import.meta.env.VITE_API_URL}/reports/low-stock/export${query ? `?${query}` : ''}`;
    return triggerDownload(url, token);
  },

  // Waste & Adjustments Report — JSON preview with cursor pagination
  getWasteAdjustments: (params?: WasteAdjustmentsParams) =>
    client.get<{
      success: boolean;
      data: {
        movements: IStockMovement[];
        nextCursor: string | null;
        hasMore: boolean;
        summary: WasteAdjustmentSummary;
        generatedAt: string;
      };
    }>('/reports/waste-adjustments', { params }),

  // Waste & Adjustments Report — CSV export
  exportWasteAdjustments: (params?: WasteAdjustmentsParams): Promise<void> => {
    const query = buildQueryString(params as Record<string, unknown> | undefined);
    const token = useAuthStore.getState().accessToken;
    const url = `${import.meta.env.VITE_API_URL}/reports/waste-adjustments/export${query ? `?${query}` : ''}`;
    return triggerDownload(url, token);
  }
};
