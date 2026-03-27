import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/**
 * Validate custom fields against tenant's custom field schema
 * Returns null if valid, error message string if invalid
 */
export function validateCustomFields(
  customFields: Record<string, unknown> | undefined,
  tenantCustomFields: Array<{ name: string; type: string; required: boolean }>
): string | null {
  if (!customFields || !tenantCustomFields || tenantCustomFields.length === 0) {
    return null;
  }

  for (const fieldDef of tenantCustomFields) {
    const value = customFields[fieldDef.name];

    if (fieldDef.required && (value === undefined || value === null || value === '')) {
      return `Custom field '${fieldDef.name}' is required`;
    }

    if (value !== undefined && value !== null && value !== '') {
      if (fieldDef.type === 'number') {
        if (typeof value !== 'number' && !Number.isFinite(Number(value))) {
          return `Custom field '${fieldDef.name}' must be a number`;
        }
      } else if (fieldDef.type === 'boolean') {
        if (typeof value !== 'boolean') {
          return `Custom field '${fieldDef.name}' must be a boolean`;
        }
      } else if (fieldDef.type === 'date') {
        const dateValue = new Date(value as string);
        if (isNaN(dateValue.getTime())) {
          return `Custom field '${fieldDef.name}' must be a valid date`;
        }
      } else if (fieldDef.type === 'text') {
        if (typeof value !== 'string') {
          return `Custom field '${fieldDef.name}' must be text`;
        }
      }
    }
  }

  return null;
}

const productBaseSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().default(''),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
  unit: z.string().min(1).max(50).trim(),
  costPrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  images: z.array(z.string().url()).max(10).default([]),
  tags: z.array(z.string().min(1).max(50).trim()).max(20).default([]),
  customFields: z.record(z.unknown()).default({})
});

export const createProductSchema = z.object({
  body: productBaseSchema.extend({
    sku: z.string().min(1).max(100).trim()
  })
});

export const updateProductSchema = z.object({
  params: z.object({ productId: mongoIdSchema }),
  body: productBaseSchema.extend({ sku: z.string().min(1).max(100).trim().optional() }).refine(
    (body) =>
      body.name !== undefined ||
      body.description !== undefined ||
      body.categoryId !== undefined ||
      body.unit !== undefined ||
      body.costPrice !== undefined ||
      body.sellingPrice !== undefined ||
      body.lowStockThreshold !== undefined ||
      body.isActive !== undefined ||
      body.images !== undefined ||
      body.tags !== undefined ||
      body.customFields !== undefined ||
      body.sku !== undefined,
    { message: 'At least one field is required' }
  )
});

export const getProductSchema = z.object({
  params: z.object({ productId: mongoIdSchema })
});

export const deleteProductSchema = z.object({
  params: z.object({ productId: mongoIdSchema })
});

export const listProductsSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    search: z.string().max(200).optional(),
    categoryId: mongoIdSchema.optional(),
    isActive: z.enum(['true', 'false', 'all']).optional().default('true'),
    lowStock: z.enum(['true']).optional(),
    sortBy: z.enum(['name', 'sku', 'totalStock', 'createdAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    unit: z.string().optional()
  })
});

export const bulkUpdateSchema = z.object({
  body: z
    .object({
      productIds: z.array(mongoIdSchema).min(1).max(100),
      updates: z.object({
        categoryId: mongoIdSchema.nullable().optional(),
        isActive: z.boolean().optional(),
        lowStockThreshold: z.coerce.number().int().min(0).optional()
      })
    })
    .refine(
      (body) =>
        body.updates.categoryId !== undefined ||
        body.updates.isActive !== undefined ||
        body.updates.lowStockThreshold !== undefined,
      { message: 'At least one update field is required' }
    )
});
