import mongoose, { Schema, model, type Document } from 'mongoose';

export interface IStockMovement extends Document {
  tenantId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE' | 'TRANSFER_OUT' | 'TRANSFER_IN';
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  totalStockBefore: number;
  totalStockAfter: number;
  referenceType: 'MANUAL' | 'PURCHASE' | 'SALE' | 'TRANSFER' | 'WASTE' | 'ADJUSTMENT';
  referenceId: mongoose.Types.ObjectId | null;
  note: string;
  performedBy: mongoose.Types.ObjectId;
  transferPairId: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    type: {
      type: String,
      enum: ['IN', 'OUT', 'ADJUSTMENT', 'WASTE', 'TRANSFER_OUT', 'TRANSFER_IN'],
      required: true
    },
    quantity: { type: Number, required: true },
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    totalStockBefore: { type: Number, required: true },
    totalStockAfter: { type: Number, required: true },
    referenceType: {
      type: String,
      enum: ['MANUAL', 'PURCHASE', 'SALE', 'TRANSFER', 'WASTE', 'ADJUSTMENT'],
      required: true
    },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String, default: '', maxlength: 500 },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transferPairId: { type: Schema.Types.ObjectId, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, warehouseId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, performedBy: 1, createdAt: -1 });
stockMovementSchema.index({ transferPairId: 1 }, { sparse: true });
stockMovementSchema.index({ tenantId: 1, referenceId: 1, createdAt: -1 }, { sparse: true });

export const StockMovementModel = model<IStockMovement>('StockMovement', stockMovementSchema);
