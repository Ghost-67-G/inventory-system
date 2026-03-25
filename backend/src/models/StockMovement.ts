import { Schema, model, type InferSchemaType } from 'mongoose';

const stockMovementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    type: {
      type: String,
      enum: ['IN', 'OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'WASTE'],
      required: true
    },
    quantity: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    referenceType: { type: String, enum: ['PURCHASE', 'SALE', 'TRANSFER', 'MANUAL', 'WASTE'], required: true },
    referenceId: { type: Schema.Types.ObjectId },
    note: { type: String, default: '' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, warehouseId: 1 });

export type StockMovement = InferSchemaType<typeof stockMovementSchema>;
export const StockMovementModel = model<StockMovement>('StockMovement', stockMovementSchema);
