import { z } from 'zod';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'CAD', 'AUD', 'SGD'] as const;

export const completeStepOneSchema = z.object({
  body: z.object({
    businessName: z.string().min(2).max(100).trim(),
    currency: z.enum(SUPPORTED_CURRENCIES),
    timezone: z.string().min(1),
    lowStockThreshold: z.number().int().min(0).max(10000).default(10)
  })
});

export const completeStepTwoSchema = z.object({
  body: z.object({
    warehouseName: z.string().min(1).max(100).trim(),
    warehouseCode: z.string().max(20).trim().optional(),
    city: z.string().max(100).trim().optional(),
    country: z.string().max(100).trim().optional()
  })
});

export const completeStepThreeSchema = z.object({
  body: z.object({
    categoryName: z.string().min(1).max(100).trim(),
    categoryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366f1'),
    productName: z.string().min(1).max(200).trim(),
    productSku: z.string().min(1).max(100).trim(),
    productUnit: z.string().min(1).max(50).trim(),
    productSellingPrice: z.number().min(0).default(0),
    productCostPrice: z.number().min(0).default(0)
  })
});

export const skipOnboardingSchema = z.object({
  body: z.object({}).optional()
});

export const resetOnboardingSchema = z.object({
  body: z.object({}).optional()
});

export type StepOneDto = z.infer<typeof completeStepOneSchema>['body'];
export type StepTwoDto = z.infer<typeof completeStepTwoSchema>['body'];
export type StepThreeDto = z.infer<typeof completeStepThreeSchema>['body'];
