import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const numString = z.coerce.number();

const addressSchema = z.object({
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(30).optional()
});

const createSupplierBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(20).optional(),
  contactName: z.string().trim().max(100).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(30).optional(),
  website: z.string().trim().url().optional(),
  address: addressSchema.optional(),
  paymentTerms: z.enum(['immediate', 'net15', 'net30', 'net45', 'net60', 'custom']).optional(),
  paymentTermsDays: z.coerce.number().int().min(1).optional(),
  currency: z.string().trim().max(10).optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(365).optional(),
  minimumOrderValue: z.coerce.number().min(0).optional(),
  notes: z.string().max(2000).optional()
});

const createSupplierBodySchema = createSupplierBaseSchema
  .superRefine((data, ctx) => {
    if (data.paymentTerms === 'custom' && (data.paymentTermsDays === undefined || data.paymentTermsDays === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'paymentTermsDays is required when paymentTerms is custom',
        path: ['paymentTermsDays']
      });
    }
  });

const updateSupplierBodySchema = createSupplierBaseSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' })
  .superRefine((data, ctx) => {
    if (data.paymentTerms === 'custom' && (data.paymentTermsDays === undefined || data.paymentTermsDays === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'paymentTermsDays is required when paymentTerms is custom',
        path: ['paymentTermsDays']
      });
    }
  });

const supplierProductBodySchema = z.object({
  productId: mongoId,
  supplierSku: z.string().trim().max(100).optional(),
  unitCost: z.coerce.number().min(0),
  currency: z.string().trim().max(10).optional(),
  minimumOrderQty: z.coerce.number().int().min(1).optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  isPreferred: z.boolean().optional(),
  notes: z.string().max(500).optional()
});

export const createSupplierSchema = z.object({
  body: createSupplierBodySchema
});

export const updateSupplierSchema = z.object({
  params: z.object({ supplierId: mongoId }),
  body: updateSupplierBodySchema
});

export const listSuppliersSchema = z.object({
  query: z.object({
    search: z.string().max(100).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    cursor: z.string().optional(),
    limit: numString.int().min(1).max(100).optional().default(20)
  })
});

export const getSupplierSchema = z.object({
  params: z.object({ supplierId: mongoId })
});

export const getSupplierProductsSchema = z.object({
  params: z.object({ supplierId: mongoId })
});

export const deactivateSupplierSchema = z.object({
  params: z.object({ supplierId: mongoId })
});

export const linkProductSchema = z.object({
  params: z.object({ supplierId: mongoId }),
  body: supplierProductBodySchema
});

export const updateSupplierProductSchema = z.object({
  params: z.object({ supplierId: mongoId, productId: mongoId }),
  body: supplierProductBodySchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' })
});

export const unlinkSupplierProductSchema = z.object({
  params: z.object({ supplierId: mongoId, productId: mongoId })
});

export const getSuppliersForProductSchema = z.object({
  params: z.object({ productId: mongoId })
});

export type ListSuppliersQuery = z.infer<typeof listSuppliersSchema>['query'];
export type CreateSupplierBody = z.infer<typeof createSupplierBaseSchema>;
export type UpdateSupplierBody = Partial<CreateSupplierBody>;
export type LinkSupplierProductBody = z.infer<typeof linkProductSchema>['body'];
export type UpdateSupplierProductBody = z.infer<typeof updateSupplierProductSchema>['body'];
