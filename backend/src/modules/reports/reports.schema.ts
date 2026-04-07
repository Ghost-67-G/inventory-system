import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const dateString = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');
const numString = z.coerce.number().int().positive();

// Stock Valuation Report
export const stockValuationQuerySchema = z.object({
  query: z.object({
    categoryId: mongoId.optional(),
    warehouseId: mongoId.optional(),
    isActive: z.enum(['true', 'false']).optional().default('true'),
    sortBy: z.enum(['name', 'sku', 'totalStock', 'stockValue']).optional().default('stockValue'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50)
  })
});

// Movements Report
export const movementsQuerySchema = z
  .object({
    query: z.object({
      dateFrom: dateString.optional(),
      dateTo: dateString.optional(),
      productId: mongoId.optional(),
      warehouseId: mongoId.optional(),
      type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'WASTE', 'TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER']).optional(),
      performedBy: mongoId.optional(),
      cursor: z.string().optional(),
      limit: numString.optional()
    })
  })
  .refine(
    (data) => {
      if (data.query.dateTo && data.query.dateFrom) {
        const from = new Date(data.query.dateFrom);
        const to = new Date(data.query.dateTo);
        return to >= from;
      }
      return true;
    },
    {
      message: 'dateTo must be >= dateFrom',
      path: ['query', 'dateTo']
    }
  );

// Low Stock Report
export const lowStockQuerySchema = z.object({
  query: z.object({
    categoryId: mongoId.optional(),
    warehouseId: mongoId.optional(),
    sortBy: z.enum(['shortage', 'name', 'currentStock']).optional().default('shortage'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(100)
  })
});

// Waste & Adjustments Report
export const wasteAdjustmentsQuerySchema = z.object({
  query: z.object({
    dateFrom: dateString.optional(),
    dateTo: dateString.optional(),
    productId: mongoId.optional(),
    warehouseId: mongoId.optional(),
    type: z.enum(['WASTE', 'ADJUSTMENT']).optional(),
    cursor: z.string().optional(),
    limit: numString.optional()
  })
});

export type StockValuationQuery = z.infer<typeof stockValuationQuerySchema>['query'];
export type MovementsQuery = z.infer<typeof movementsQuerySchema>['query'];
export type LowStockQuery = z.infer<typeof lowStockQuerySchema>['query'];
export type WasteAdjustmentsQuery = z.infer<typeof wasteAdjustmentsQuerySchema>['query'];
