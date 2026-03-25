import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['owner', 'manager', 'staff', 'viewer'])
  })
});
