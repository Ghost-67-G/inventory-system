import { Schema, model, type InferSchemaType } from 'mongoose';

const warehouseSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

warehouseSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export type Warehouse = InferSchemaType<typeof warehouseSchema>;
export const WarehouseModel = model<Warehouse>('Warehouse', warehouseSchema);
