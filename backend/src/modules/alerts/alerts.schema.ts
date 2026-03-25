import { z } from 'zod';

export const acknowledgeAlertSchema = z.object({
  body: z.object({
    alertId: z.string().min(1)
  })
});
