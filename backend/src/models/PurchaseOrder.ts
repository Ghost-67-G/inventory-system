import mongoose, { Document, Schema, model } from 'mongoose';

export type POStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';

export interface IPOLineItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  productSku: string;
  unit: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  totalCost: number;
  notes: string;
}

export interface IPurchaseOrder extends Document {
  tenantId: mongoose.Types.ObjectId;
  poNumber: string;
  supplierId: mongoose.Types.ObjectId;
  supplierName: string;
  warehouseId: mongoose.Types.ObjectId;
  warehouseName: string;
  status: POStatus;
  lineItems: IPOLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  currency: string;
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  receivedDate: Date | null;
  notes: string;
  supplierReference: string;
  attachmentUrls: string[];
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema<IPOLineItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, trim: true, maxlength: 200 },
    productSku: { type: String, required: true, trim: true, maxlength: 100 },
    unit: { type: String, required: true, trim: true, maxlength: 50 },
    orderedQty: { type: Number, required: true, min: 0.000001 },
    receivedQty: { type: Number, required: true, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '', trim: true, maxlength: 200 }
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    poNumber: { type: String, required: true, trim: true, maxlength: 30 },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String, required: true, trim: true, maxlength: 200 },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    warehouseName: { type: String, required: true, trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED'],
      default: 'DRAFT',
      required: true
    },
    lineItems: {
      type: [lineItemSchema],
      required: true,
      validate: {
        validator: (items: IPOLineItem[]) => Array.isArray(items) && items.length > 0,
        message: 'At least one line item is required'
      }
    },
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 10 },
    orderDate: { type: Date, default: Date.now, required: true },
    expectedDeliveryDate: { type: Date, default: null },
    receivedDate: { type: Date, default: null },
    notes: { type: String, default: '', trim: true, maxlength: 2000 },
    supplierReference: { type: String, default: '', trim: true, maxlength: 100 },
    attachmentUrls: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ tenantId: 1, supplierId: 1, createdAt: -1 });
purchaseOrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
purchaseOrderSchema.index({ tenantId: 1, warehouseId: 1, createdAt: -1 });
purchaseOrderSchema.index({ tenantId: 1, createdAt: -1 });

export const PurchaseOrderModel = model<IPurchaseOrder>('PurchaseOrder', purchaseOrderSchema);
