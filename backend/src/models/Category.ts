import { Schema, model, type InferSchemaType } from 'mongoose';

const categorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

categorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

export type Category = InferSchemaType<typeof categorySchema>;
export const CategoryModel = model<Category>('Category', categorySchema);
