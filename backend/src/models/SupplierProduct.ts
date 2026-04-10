import mongoose, { Document, Schema, model } from 'mongoose';

export interface ISupplierProduct extends Document {
  tenantId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  supplierSku: string;
  unitCost: number;
  currency: string;
  minimumOrderQty: number;
  leadTimeDays: number;
  isPreferred: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const supplierProductSchema = new Schema<ISupplierProduct>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    supplierSku: { type: String, default: '', trim: true, maxlength: 100 },
    unitCost: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', trim: true, uppercase: true, maxlength: 10 },
    minimumOrderQty: { type: Number, default: 1, min: 1 },
    leadTimeDays: { type: Number, default: 0, min: 0, max: 365 },
    isPreferred: { type: Boolean, default: false },
    notes: { type: String, default: '', trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

supplierProductSchema.index({ tenantId: 1, supplierId: 1, productId: 1 }, { unique: true });
supplierProductSchema.index({ tenantId: 1, productId: 1 });
supplierProductSchema.index({ tenantId: 1, productId: 1, isPreferred: 1 });

export const SupplierProductModel = model<ISupplierProduct>('SupplierProduct', supplierProductSchema);
