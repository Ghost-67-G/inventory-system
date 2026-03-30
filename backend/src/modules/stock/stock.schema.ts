import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const dateString = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');

export const recordInSchema = z.object({
  body: z.object({
    productId: mongoId,
    warehouseId: mongoId,
    quantity: z.coerce.number().positive(),
    referenceType: z.enum(['MANUAL', 'PURCHASE']).optional().default('MANUAL'),
    referenceId: mongoId.optional(),
    note: z.string().max(500).optional()
  })
});

export const recordOutSchema = z.object({
  body: z.object({
    productId: mongoId,
    warehouseId: mongoId,
    quantity: z.coerce.number().positive(),
    referenceType: z.enum(['MANUAL', 'SALE']).optional().default('MANUAL'),
    referenceId: mongoId.optional(),
    note: z.string().max(500).optional()
  })
});

export const recordAdjustmentSchema = z.object({
  body: z.object({
    productId: mongoId,
    warehouseId: mongoId,
    quantity: z.coerce.number().refine((value) => value !== 0, 'Quantity cannot be zero'),
    note: z.string().max(500).optional()
  })
});

export const recordWasteSchema = z.object({
  body: z.object({
    productId: mongoId,
    warehouseId: mongoId,
    quantity: z.coerce.number().positive(),
    note: z.string().max(500).optional()
  })
});

export const recordTransferSchema = z.object({
  body: z
    .object({
      productId: mongoId,
      sourceWarehouseId: mongoId,
      destinationWarehouseId: mongoId,
      quantity: z.coerce.number().positive(),
      note: z.string().max(500).optional()
    })
    .refine((data) => data.sourceWarehouseId !== data.destinationWarehouseId, {
      message: 'Source and destination warehouses must be different',
      path: ['destinationWarehouseId']
    })
});

export const listMovementsSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    productId: mongoId.optional(),
    warehouseId: mongoId.optional(),
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'WASTE', 'TRANSFER_OUT', 'TRANSFER_IN']).optional(),
    performedBy: mongoId.optional(),
    dateFrom: dateString.optional(),
    dateTo: dateString.optional()
  })
});

export const getMovementSchema = z.object({
  params: z.object({
    id: mongoId
  })
});

export const getProductStockSchema = z.object({
  params: z.object({
    productId: mongoId
  })
});

export const listAlertsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'ACKNOWLEDGED']).optional(),
    productId: mongoId.optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50)
  })
});

export const acknowledgeAlertSchema = z.object({
  params: z.object({
    id: mongoId
  })
});

export const bulkAcknowledgeSchema = z.object({
  body: z.object({
    alertIds: z.array(mongoId).min(1).max(100)
  })
});
