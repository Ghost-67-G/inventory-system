import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    tenantId: z.string().min(1).optional(),
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['owner', 'manager', 'staff', 'viewer']).optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    tenantId: z.string().min(1).optional(),
    email: z.string().email(),
    password: z.string().min(8)
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email()
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(10),
    newPassword: z.string().min(8)
  })
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(10)
  })
});
