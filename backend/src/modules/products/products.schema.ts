import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    sku: z.string().min(1),
    name: z.string().min(1),
    unit: z.string().min(1),
    costPrice: z.number().nonnegative(),
    sellingPrice: z.number().nonnegative()
  })
});
