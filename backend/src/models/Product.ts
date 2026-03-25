import { Schema, model, type InferSchemaType } from 'mongoose';

const productSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    unit: { type: String, required: true, trim: true },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    totalStock: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    isActive: { type: Boolean, default: true },
    images: { type: [String], default: [] },
    customFields: { type: Map, of: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
productSchema.index({ tenantId: 1, categoryId: 1 });
productSchema.index({ tenantId: 1, isActive: 1 });
productSchema.index({ name: 'text', sku: 'text', description: 'text' });

export type Product = InferSchemaType<typeof productSchema>;
export const ProductModel = model<Product>('Product', productSchema);
