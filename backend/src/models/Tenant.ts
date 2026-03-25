import { Schema, model, type InferSchemaType } from 'mongoose';

const customFieldSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'boolean', 'date'], required: true },
    required: { type: Boolean, default: false }
  },
  { _id: false }
);

const tenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
    settings: {
      currency: { type: String, default: 'USD' },
      timezone: { type: String, default: 'UTC' },
      lowStockThreshold: { type: Number, default: 10 }
    },
    customFields: { type: [customFieldSchema], default: [] }
  },
  { timestamps: true }
);

export type Tenant = InferSchemaType<typeof tenantSchema>;
export const TenantModel = model<Tenant>('Tenant', tenantSchema);
