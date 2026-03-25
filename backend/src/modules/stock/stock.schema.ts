import { z } from 'zod';

export const listStockSchema = z.object({
  query: z.object({
    productId: z.string().optional()
  })
});
