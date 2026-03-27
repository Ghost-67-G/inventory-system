import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g. #6366f1)');

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().max(500).optional(),
    color: hexColorSchema.optional()
  })
});

export const updateCategorySchema = z.object({
  params: z.object({ categoryId: mongoIdSchema }),
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      description: z.string().max(500).optional(),
      color: hexColorSchema.optional(),
      isActive: z.boolean().optional()
    })
    .refine(
      (body) =>
        body.name !== undefined ||
        body.description !== undefined ||
        body.color !== undefined ||
        body.isActive !== undefined,
      { message: 'At least one field is required' }
    )
});

export const getCategorySchema = z.object({
  params: z.object({ categoryId: mongoIdSchema })
});

export const deleteCategorySchema = z.object({
  params: z.object({ categoryId: mongoIdSchema })
});

export const listCategoriesSchema = z.object({
  query: z.object({
    search: z.string().max(100).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
});
