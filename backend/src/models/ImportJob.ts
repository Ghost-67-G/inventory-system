import mongoose, { Schema, model } from 'mongoose';

export type ImportJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';

export interface IImportJobError {
  row: number;
  sku: string;
  field: string;
  message: string;
}

export interface IImportJob {
  tenantId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  status: ImportJobStatus;
  fileName: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  errors: IImportJobError[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const importJobErrorSchema = new Schema<IImportJobError>(
  {
    row: { type: Number, required: true },
    sku: { type: String, required: true, default: '' },
    field: { type: String, required: true },
    message: { type: String, required: true }
  },
  { _id: false }
);

const importJobSchema = new Schema<IImportJob>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL'],
      default: 'PENDING',
      required: true
    },
    fileName: { type: String, required: true, trim: true, maxlength: 300 },
    totalRows: { type: Number, required: true, min: 0 },
    processedRows: { type: Number, required: true, min: 0, default: 0 },
    successCount: { type: Number, required: true, min: 0, default: 0 },
    errorCount: { type: Number, required: true, min: 0, default: 0 },
    errors: { type: [importJobErrorSchema], default: [] },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

importJobSchema.index({ tenantId: 1, createdAt: -1 });
importJobSchema.index({ tenantId: 1, status: 1 });

// Keep completed import jobs for 30 days.
importJobSchema.index(
  { completedAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 30,
    partialFilterExpression: { completedAt: { $type: 'date' } }
  }
);

export const ImportJob = model<IImportJob>('ImportJob', importJobSchema);
