import mongoose, { Document, Schema, model } from 'mongoose';

export type AuditAction =
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'category.created'
  | 'category.updated'
  | 'category.deleted'
  | 'warehouse.created'
  | 'warehouse.updated'
  | 'warehouse.deactivated'
  | 'warehouse.reactivated'
  | 'user.invited'
  | 'user.role_changed'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'stock.adjusted'
  | 'settings.updated'
  | 'supplier.created'
  | 'supplier.updated'
  | 'supplier.deactivated'
  | 'po.created'
  | 'po.updated'
  | 'po.sent'
  | 'po.received'
  | 'po.partial_received'
  | 'po.cancelled';

export type AuditEntityType = 'product' | 'category' | 'warehouse' | 'user' | 'stock' | 'settings' | 'supplier' | 'purchase_order';

export interface IAuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface IAuditLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  performedBy: mongoose.Types.ObjectId;
  performedByName: string;
  performedByEmail: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: mongoose.Types.ObjectId | null;
  entityName: string;
  changes: IAuditChange[];
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

const auditChangeSchema = new Schema<IAuditChange>(
  {
    field: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const auditLogSchema = new Schema<IAuditLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, required: true, trim: true },
    performedByEmail: { type: String, required: true, trim: true, lowercase: true },
    action: {
      type: String,
      enum: [
        'product.created',
        'product.updated',
        'product.deleted',
        'category.created',
        'category.updated',
        'category.deleted',
        'warehouse.created',
        'warehouse.updated',
        'warehouse.deactivated',
        'warehouse.reactivated',
        'user.invited',
        'user.role_changed',
        'user.deactivated',
        'user.reactivated',
        'stock.adjusted',
        'settings.updated',
        'supplier.created',
        'supplier.updated',
        'supplier.deactivated',
        'po.created',
        'po.updated',
        'po.sent',
        'po.received',
        'po.partial_received',
        'po.cancelled'
      ],
      required: true
    },
    entityType: {
      type: String,
      enum: ['product', 'category', 'warehouse', 'user', 'stock', 'settings', 'supplier', 'purchase_order'],
      required: true
    },
    entityId: { type: Schema.Types.ObjectId, default: null },
    entityName: { type: String, required: true, trim: true },
    changes: { type: [auditChangeSchema], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, entityType: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, performedBy: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);