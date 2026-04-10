import { z } from 'zod';
import type { POStatus } from '../../models/PurchaseOrder';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const dateString = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');

const createLineItemSchema = z.object({
  productId: mongoId,
  orderedQty: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0),
  notes: z.string().max(200).optional()
});

const receiveLineItemSchema = z.object({
  productId: mongoId,
  receivedQty: z.coerce.number().positive(),
  notes: z.string().optional()
});

function hasDuplicateProductIds(items: Array<{ productId: string }>): boolean {
  const ids = items.map((item) => item.productId);
  return new Set(ids).size !== ids.length;
}

export const createPOSchema = z.object({
  body: z
    .object({
      supplierId: mongoId,
      warehouseId: mongoId,
      expectedDeliveryDate: dateString.optional(),
      taxRate: z.coerce.number().min(0).max(100).optional(),
      shippingCost: z.coerce.number().min(0).optional(),
      notes: z.string().max(2000).optional(),
      supplierReference: z.string().max(100).optional(),
      lineItems: z.array(createLineItemSchema).min(1).max(100)
    })
    .refine((body) => !hasDuplicateProductIds(body.lineItems), {
      message: 'Duplicate products are not allowed in line items',
      path: ['lineItems']
    })
});

export const updatePOSchema = z.object({
  params: z.object({ poId: mongoId }),
  body: z
    .object({
      supplierId: mongoId.optional(),
      warehouseId: mongoId.optional(),
      expectedDeliveryDate: dateString.optional(),
      taxRate: z.coerce.number().min(0).max(100).optional(),
      shippingCost: z.coerce.number().min(0).optional(),
      notes: z.string().max(2000).optional(),
      supplierReference: z.string().max(100).optional(),
      lineItems: z.array(createLineItemSchema).min(1).max(100).optional()
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' })
    .refine((body) => (body.lineItems ? !hasDuplicateProductIds(body.lineItems) : true), {
      message: 'Duplicate products are not allowed in line items',
      path: ['lineItems']
    })
});

export const sendPOSchema = z.object({
  params: z.object({ poId: mongoId }),
  body: z.object({
    sendEmail: z.boolean().optional().default(true)
  })
});

export const receiveItemsSchema = z.object({
  params: z.object({ poId: mongoId }),
  body: z
    .object({
      lineItems: z.array(receiveLineItemSchema).min(1),
      receivedDate: dateString.optional()
    })
    .refine((body) => !hasDuplicateProductIds(body.lineItems), {
      message: 'Duplicate products are not allowed in receipt',
      path: ['lineItems']
    })
});

export const cancelPOSchema = z.object({
  params: z.object({ poId: mongoId }),
  body: z.object({
    reason: z.string().max(500).optional()
  })
});

export const getPOSchema = z.object({
  params: z.object({ poId: mongoId })
});

export const listPOsSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED', 'OPEN']).optional(),
    supplierId: mongoId.optional(),
    warehouseId: mongoId.optional(),
    dateFrom: dateString.optional(),
    dateTo: dateString.optional(),
    search: z.string().max(100).optional()
  })
});

export type ListPOsQuery = z.infer<typeof listPOsSchema>['query'];
export type CreatePOBody = z.infer<typeof createPOSchema>['body'];
export type UpdatePOBody = z.infer<typeof updatePOSchema>['body'];
export type SendPOBody = z.infer<typeof sendPOSchema>['body'];
export type ReceiveItemsBody = z.infer<typeof receiveItemsSchema>['body'];
export type CancelPOBody = z.infer<typeof cancelPOSchema>['body'];
export type POStatusFilter = POStatus | 'OPEN';
