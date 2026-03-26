import mongoose, { Document, Schema, model } from 'mongoose';

export type CustomFieldType = 'text' | 'number' | 'boolean' | 'date';

export interface ICustomField {
  _id: mongoose.Types.ObjectId;
  name: string;
  key: string;
  type: CustomFieldType;
  required: boolean;
  defaultValue?: string;
  order: number;
}

export interface ITenantSettings {
  currency: string;
  timezone: string;
  lowStockThreshold: number;
  dateFormat: string;
  measurementUnit: 'metric' | 'imperial';
}

export interface ITenant extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  isActive: boolean;
  settings: ITenantSettings;
  customFields: mongoose.Types.DocumentArray<ICustomField & Document>;
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customFieldSchema = new Schema<ICustomField>(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'boolean', 'date'], required: true },
    required: { type: Boolean, default: false },
    defaultValue: { type: String },
    order: { type: Number, default: 0 }
  },
  { _id: true }
);

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    settings: {
      currency: { type: String, default: 'USD' },
      timezone: { type: String, default: 'UTC' },
      lowStockThreshold: { type: Number, default: 10 },
      dateFormat: { type: String, default: 'MM/DD/YYYY' },
      measurementUnit: { type: String, enum: ['metric', 'imperial'], default: 'metric' }
    },
    customFields: { type: [customFieldSchema], default: [] },
    onboardingComplete: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const TenantModel = model<ITenant>('Tenant', tenantSchema);
