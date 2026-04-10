import mongoose, { Document, Schema, model } from 'mongoose';

export type PaymentTerms = 'immediate' | 'net15' | 'net30' | 'net45' | 'net60' | 'custom';

export interface ISupplier extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  paymentTerms: PaymentTerms;
  paymentTermsDays: number;
  currency: string;
  leadTimeDays: number;
  minimumOrderValue: number;
  notes: string;
  isActive: boolean;
  totalOrders: number;
  totalOrderValue: number;
  lastOrderDate: Date | null;
  onTimeDeliveryRate: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema(
  {
    street: { type: String, default: '', trim: true, maxlength: 200 },
    city: { type: String, default: '', trim: true, maxlength: 100 },
    state: { type: String, default: '', trim: true, maxlength: 100 },
    country: { type: String, default: '', trim: true, maxlength: 100 },
    postalCode: { type: String, default: '', trim: true, maxlength: 30 }
  },
  { _id: false }
);

const supplierSchema = new Schema<ISupplier>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    contactName: { type: String, default: '', trim: true, maxlength: 100 },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    website: { type: String, default: '', trim: true, maxlength: 300 },
    address: { type: addressSchema, default: () => ({}) },
    paymentTerms: {
      type: String,
      enum: ['immediate', 'net15', 'net30', 'net45', 'net60', 'custom'],
      default: 'net30'
    },
    paymentTermsDays: { type: Number, default: 30, min: 0, max: 3650 },
    currency: { type: String, default: 'USD', trim: true, uppercase: true, maxlength: 10 },
    leadTimeDays: { type: Number, default: 7, min: 0, max: 365 },
    minimumOrderValue: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '', trim: true, maxlength: 2000 },
    isActive: { type: Boolean, default: true },
    totalOrders: { type: Number, default: 0, min: 0 },
    totalOrderValue: { type: Number, default: 0, min: 0 },
    lastOrderDate: { type: Date, default: null },
    onTimeDeliveryRate: { type: Number, default: 0, min: 0, max: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

supplierSchema.index({ tenantId: 1, code: 1 }, { unique: true });
supplierSchema.index({ tenantId: 1, isActive: 1 });
supplierSchema.index({ tenantId: 1, name: 1 });

supplierSchema.pre('save', function (next) {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }
  if (this.name) {
    this.name = this.name.trim();
  }
  next();
});

export const SupplierModel = model<ISupplier>('Supplier', supplierSchema);
