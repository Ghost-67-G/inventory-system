import mongoose, { Schema, model, type Document } from 'mongoose';

export interface IStockAlert extends Document {
  tenantId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  currentStock: number;
  threshold: number;
  status: 'PENDING' | 'ACKNOWLEDGED';
  acknowledgedBy: mongoose.Types.ObjectId | null;
  acknowledgedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const stockAlertSchema = new Schema<IStockAlert>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    currentStock: { type: Number, required: true },
    threshold: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'ACKNOWLEDGED'], default: 'PENDING' },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    acknowledgedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

stockAlertSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
stockAlertSchema.index({ tenantId: 1, productId: 1, warehouseId: 1, status: 1 });

export const StockAlertModel = model<IStockAlert>('StockAlert', stockAlertSchema);
