import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const addressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  state: z.string().max(200).optional(),
  country: z.string().max(200).optional(),
  postalCode: z.string().max(200).optional()
});

export const createWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).trim(),
    code: z
      .string()
      .min(1)
      .max(20)
      .trim()
      .regex(/^[A-Z0-9-]+$/, 'Code must contain only uppercase letters, numbers, and dashes')
      .optional(),
    description: z.string().max(500).optional(),
    address: addressSchema.optional(),
    isDefault: z.boolean().optional()
  })
});

export const updateWarehouseSchema = z.object({
  params: z.object({ warehouseId: mongoIdSchema }),
  body: z
    .object({
      name: z.string().min(1).max(100).trim().optional(),
      code: z
        .string()
        .min(1)
        .max(20)
        .trim()
        .regex(/^[A-Z0-9-]+$/, 'Code must contain only uppercase letters, numbers, and dashes')
        .optional(),
      description: z.string().max(500).optional(),
      address: addressSchema.optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional()
    })
    .refine(
      (body) =>
        body.name !== undefined ||
        body.code !== undefined ||
        body.description !== undefined ||
        body.address !== undefined ||
        body.isDefault !== undefined ||
        body.isActive !== undefined,
      { message: 'At least one field is required' }
    )
});

export const getWarehouseSchema = z.object({
  params: z.object({ warehouseId: mongoIdSchema })
});

export const deactivateWarehouseSchema = z.object({
  params: z.object({ warehouseId: mongoIdSchema })
});

export const reactivateWarehouseSchema = z.object({
  params: z.object({ warehouseId: mongoIdSchema })
});

export const setDefaultWarehouseSchema = z.object({
  params: z.object({ warehouseId: mongoIdSchema })
});

export const listWarehousesSchema = z.object({
  query: z.object({
    isActive: z.enum(['true', 'false']).optional(),
    search: z.string().max(100).optional()
  })
});

export const warehouseStockSchema = z.object({
  params: z.object({ warehouseId: mongoIdSchema }),
  query: z.object({
    search: z.string().max(100).optional(),
    lowStock: z.enum(['true', 'false']).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
});
