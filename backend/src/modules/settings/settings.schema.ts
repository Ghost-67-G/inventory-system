import { z } from 'zod';

const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'CAD', 'AUD',
  'JPY', 'CNY', 'CHF', 'MXN', 'BRL', 'SGD', 'HKD', 'NOK', 'SEK',
  'DKK', 'NZD', 'ZAR', 'EGP', 'NGN', 'KWD', 'QAR', 'BDT', 'THB',
  'MYR', 'IDR', 'PHP',
] as const;

export const updateGeneralSettingsSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    settings: z.object({
      currency: z.enum(SUPPORTED_CURRENCIES).optional(),
      timezone: z.string().refine(
        tz => {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        },
        { message: 'Invalid timezone' }
      ).optional(),
      lowStockThreshold: z.number().int().min(0).max(100000).optional(),
      dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
      measurementUnit: z.enum(['metric', 'imperial']).optional(),
    }).optional(),
  }).refine(data => data.name !== undefined || (data.settings && Object.keys(data.settings).length > 0), {
    message: 'At least one field must be provided',
  }),
});

export const addCustomFieldSchema = z.object({
  body: z.object({
    name: z.string()
      .min(2).max(50).trim()
      .regex(/^[a-zA-Z][a-zA-Z0-9 _-]*$/, 'Field name must start with a letter and contain only letters, numbers, spaces, hyphens, underscores'),
    type: z.enum(['text', 'number', 'boolean', 'date']),
    required: z.boolean().default(false),
    defaultValue: z.string().max(200).optional(),
  }),
});

export const updateCustomFieldSchema = z.object({
  params: z.object({
    fieldId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid field ID'),
  }),
  body: z.object({
    name: z.string().min(2).max(50).trim().optional(),
    required: z.boolean().optional(),
    defaultValue: z.string().max(200).optional(),
    order: z.number().int().min(0).optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  }),
});

export const deleteCustomFieldSchema = z.object({
  params: z.object({
    fieldId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid field ID'),
  }),
});

export const reorderCustomFieldsSchema = z.object({
  body: z.object({
    fields: z.array(z.object({
      fieldId: z.string().regex(/^[0-9a-fA-F]{24}$/),
      order: z.number().int().min(0),
    })).min(1),
  }),
});

export const updateNotificationPreferencesSchema = z.object({
  body: z
    .object({
      lowStockAlerts: z.boolean().optional(),
      dailySummary: z.boolean().optional(),
      importCompletion: z.boolean().optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one preference must be provided'
    })
});

export type UpdateGeneralSettingsBody = z.infer<typeof updateGeneralSettingsSchema>['body'];
export type AddCustomFieldBody = z.infer<typeof addCustomFieldSchema>['body'];
export type UpdateCustomFieldBody = z.infer<typeof updateCustomFieldSchema>['body'];
export type ReorderCustomFieldsBody = z.infer<typeof reorderCustomFieldsSchema>['body'];
export type UpdateNotificationPreferencesBody = z.infer<typeof updateNotificationPreferencesSchema>['body'];
