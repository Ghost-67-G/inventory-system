import { z } from 'zod';

const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user id');
const manageableRoleSchema = z.enum(['manager', 'staff', 'viewer']);

export const inviteUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    role: manageableRoleSchema
  })
});

export const updateUserSchema = z.object({
  params: z.object({ userId: mongoIdSchema }),
  body: z
    .object({
      name: z.string().min(2).max(100).optional(),
      role: manageableRoleSchema.optional()
    })
    .refine((body) => body.name !== undefined || body.role !== undefined, {
      message: 'At least one field is required'
    })
});

export const deactivateUserSchema = z.object({
  params: z.object({ userId: mongoIdSchema })
});

export const reactivateUserSchema = z.object({
  params: z.object({ userId: mongoIdSchema })
});

export const getUserSchema = z.object({
  params: z.object({ userId: mongoIdSchema })
});

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    role: z.enum(['owner', 'manager', 'staff', 'viewer']).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    search: z.string().trim().optional()
  })
});

export const updateMyProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100)
  })
});
