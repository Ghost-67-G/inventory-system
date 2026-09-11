import { z } from 'zod';
import { config } from '../../config';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const baseRegisterBody = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: passwordSchema
});

const saasRegisterBody = baseRegisterBody.extend({
  tenantName: z.string().min(2).max(100)
});

export const registerSchema = z.object({
  body:
    config.DEPLOYMENT_MODE === 'saas'
      ? saasRegisterBody
      : baseRegisterBody
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
    password: z.string().min(1)
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase()
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: passwordSchema
  })
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1)
  })
});

export const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: passwordSchema
  })
});

export const resendVerificationSchema = z.object({
  body: z
    .object({
      email: z.string().email().toLowerCase().optional()
    })
    .optional()
    .default({})
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema
  })
});
