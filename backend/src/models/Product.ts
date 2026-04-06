import mongoose, { Schema, model, type InferSchemaType } from 'mongoose';

const productSchema = new Schema(
  {
    tenantId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Tenant', 
      required: true 
    },
    sku: { 
      type: String, 
      required: true, 
      trim: true, 
      uppercase: true,
      maxlength: 100 
    },
    name: { 
      type: String, 
      required: true, 
      trim: true, 
      maxlength: 200 
    },
    description: { 
      type: String, 
      default: '', 
      maxlength: 2000,
      trim: true
    },
    categoryId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Category', 
      default: null 
    },
    unit: { 
      type: String, 
      required: true, 
      maxlength: 50,
      trim: true
    },
    costPrice: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    sellingPrice: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    totalStock: { 
      type: Number, 
      default: 0, 
      min: 0,
      select: true
    },
    lowStockThreshold: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    images: { 
      type: [String], 
      default: [] 
    },
    tags: { 
      type: [String], 
      default: [] 
    },
    customFields: { 
      type: Map, 
      of: Schema.Types.Mixed,
      default: new Map()
    },
    createdBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    updatedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    }
  },
  { timestamps: true }
);

// CRITICAL INDEXES for performance with large datasets
productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
productSchema.index({ tenantId: 1, categoryId: 1 });
productSchema.index({ tenantId: 1, isActive: 1, createdAt: -1 });
productSchema.index({ tenantId: 1, createdAt: -1 });
productSchema.index({ tenantId: 1, totalStock: 1 });
productSchema.index(
  { tenantId: 1, name: 'text', sku: 'text', description: 'text', tags: 'text' },
  { default_language: 'english' }
);

// Pre-save hook: normalize data
productSchema.pre('save', function (next) {
  if (this.isModified('sku')) {
    this.sku = this.sku.trim().toUpperCase();
  }
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  if (this.isModified('description') && this.description) {
    this.description = (this.description as string).trim();
  }
  if (this.isModified('tags') && this.tags) {
    this.tags = (this.tags as string[]).map((tag) => tag.toLowerCase().trim());
  }
  next();
});

export type IProduct = InferSchemaType<typeof productSchema> & { 
  _id: mongoose.Types.ObjectId;
};

export const Product = model<IProduct>('Product', productSchema);
