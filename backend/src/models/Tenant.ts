import mongoose, { Document, Schema, model } from 'mongoose';

export interface ITenant extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  isActive: boolean;
  settings: {
    currency: string;
    timezone: string;
    lowStockThreshold: number;
  };
  customFields: Array<{
    name: string;
    type: 'text' | 'number' | 'boolean' | 'date';
    required: boolean;
  }>;
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customFieldSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'boolean', 'date'], required: true },
    required: { type: Boolean, default: false }
  },
  { _id: false }
);

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    settings: {
      currency: { type: String, default: 'USD' },
      timezone: { type: String, default: 'UTC' },
      lowStockThreshold: { type: Number, default: 10 }
    },
    customFields: { type: [customFieldSchema], default: [] },
    onboardingComplete: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const TenantModel = model<ITenant>('Tenant', tenantSchema);
