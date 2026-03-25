import { Schema, model, type InferSchemaType } from 'mongoose';

const stockAlertSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    currentStock: { type: Number, required: true },
    threshold: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'ACKNOWLEDGED'], default: 'PENDING' },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date }
  },
  { timestamps: true }
);

stockAlertSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export type StockAlert = InferSchemaType<typeof stockAlertSchema>;
export const StockAlertModel = model<StockAlert>('StockAlert', stockAlertSchema);
