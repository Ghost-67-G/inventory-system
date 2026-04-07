import mongoose, { Schema, model, type Document, type InferSchemaType } from 'mongoose';

const warehouseStockSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 0,
      min: 0
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: false }
);

// Indexes
warehouseStockSchema.index({ tenantId: 1, warehouseId: 1, productId: 1 }, { unique: true });
warehouseStockSchema.index({ tenantId: 1, productId: 1 });
warehouseStockSchema.index({ tenantId: 1, warehouseId: 1 });
warehouseStockSchema.index({ quantity: 1 });
// Low-stock report: filter by tenant + threshold > 0 + quantity <= threshold
warehouseStockSchema.index({ tenantId: 1, lowStockThreshold: 1, quantity: 1 });
// Low-stock report with warehouse filter
warehouseStockSchema.index({ tenantId: 1, warehouseId: 1, lowStockThreshold: 1, quantity: 1 });

export interface IWarehouseStock extends Document {
  tenantId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  lowStockThreshold: number;
  reservedQuantity: number;
  updatedAt: Date;
}

export type WarehouseStock = InferSchemaType<typeof warehouseStockSchema>;
export const WarehouseStockModel = model<IWarehouseStock>('WarehouseStock', warehouseStockSchema);
