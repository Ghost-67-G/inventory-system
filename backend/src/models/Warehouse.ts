import mongoose, { Schema, model, type Document, type InferSchemaType } from 'mongoose';

const addressSchema = new Schema(
  {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    postalCode: { type: String, default: '' }
  },
  { _id: false }
);

const warehouseSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
      trim: true
    },
    address: {
      type: addressSchema,
      default: () => ({})
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// Indexes
warehouseSchema.index({ tenantId: 1, code: 1 }, { unique: true });
warehouseSchema.index({ tenantId: 1, isActive: 1 });
warehouseSchema.index({ tenantId: 1, isDefault: 1 });
warehouseSchema.index({ tenantId: 1, createdAt: -1 });

// Pre-save hook: normalize code to uppercase and trim name
warehouseSchema.pre('save', function (next) {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }
  if (this.name) {
    this.name = this.name.trim();
  }
  next();
});

export interface IWarehouse extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  isActive: boolean;
  isDefault: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type Warehouse = InferSchemaType<typeof warehouseSchema>;
export const WarehouseModel = model<IWarehouse>('Warehouse', warehouseSchema);
