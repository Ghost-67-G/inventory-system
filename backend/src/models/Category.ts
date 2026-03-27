import { Schema, model, type InferSchemaType } from 'mongoose';

const categorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    color: {
      type: String,
      required: true,
      default: '#6366f1',
      validate: {
        validator: (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v),
        message: 'Color must be a valid hex color (e.g. #6366f1)'
      }
    },
    productCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

categorySchema.index({ tenantId: 1, isActive: 1 });

// Pre-save hook: trim name and description
categorySchema.pre('save', function (next) {
  if (this.isModified('name')) this.name = this.name.trim();
  if (this.isModified('description') && this.description) {
    this.description = (this.description as string).trim();
  }
  next();
});

export type ICategory = InferSchemaType<typeof categorySchema> & { _id: unknown };
export const CategoryModel = model<ICategory>('Category', categorySchema);
