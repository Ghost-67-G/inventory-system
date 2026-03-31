import fs from 'fs';
import mongoose from 'mongoose';
import { Job, Worker } from 'bullmq';
import { parse } from 'csv-parse';
import { config } from '../../config';
import { getIO } from '../../config/socket';
import { CategoryModel } from '../../models/Category';
import { ImportJob, type IImportJobError, type ImportJobStatus } from '../../models/ImportJob';
import { Product } from '../../models/Product';
import { TenantModel } from '../../models/Tenant';
import { enqueueProductUpsert } from '../jobs/searchSync.job';
import { enqueueImportCompletionEmail } from '../jobs/emailNotification.job';
import { logger } from '../../utils/logger';

interface CsvImportPayload {
  jobId: string;
  tenantId: string;
  userId: string;
  filePath: string;
  fileName: string;
}

interface ValidatedRow {
  sku: string;
  name: string;
  categoryId: mongoose.Types.ObjectId | null;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  lowStockThreshold: number;
  description: string;
  tags: string[];
}

interface ValidationContext {
  categoryMap: Map<string, mongoose.Types.ObjectId>;
  existingSkuSet: Set<string>;
  seenSkusInFile: Set<string>;
  defaultThreshold: number;
}

const MAX_STORED_ERRORS = 100;
const ERROR_LIMIT_MESSAGE = 'More than 100 errors - only first 100 shown';

function addImportError(errors: IImportJobError[], error: IImportJobError): void {
  if (errors.length < MAX_STORED_ERRORS) {
    errors.push(error);
    return;
  }

  if (errors.length === MAX_STORED_ERRORS) {
    errors.push({ row: -1, sku: '', field: 'file', message: ERROR_LIMIT_MESSAGE });
  }
}

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];

  const unique = new Set<string>();
  for (const piece of value.split(',')) {
    const normalized = piece.trim().toLowerCase();
    if (!normalized) continue;
    unique.add(normalized);
    if (unique.size >= 20) break;
  }

  return Array.from(unique);
}

function validateRow(
  rawRow: Record<string, unknown>,
  rowNumber: number,
  context: ValidationContext
): { valid: true; row: ValidatedRow } | { valid: false; error: IImportJobError } {
  const rawSku = String(rawRow.sku ?? '').trim();
  const sku = rawSku.toUpperCase();

  if (!rawSku) {
    return { valid: false, error: { row: rowNumber, sku: '', field: 'sku', message: 'SKU is required' } };
  }
  if (sku.length > 100) {
    return {
      valid: false,
      error: { row: rowNumber, sku, field: 'sku', message: 'SKU must be 100 chars or less' }
    };
  }
  if (context.existingSkuSet.has(sku)) {
    return {
      valid: false,
      error: { row: rowNumber, sku, field: 'sku', message: 'SKU already exists in your inventory' }
    };
  }
  if (context.seenSkusInFile.has(sku)) {
    return {
      valid: false,
      error: { row: rowNumber, sku, field: 'sku', message: 'Duplicate SKU in this file' }
    };
  }

  const name = String(rawRow.name ?? '').trim();
  if (!name) {
    return {
      valid: false,
      error: { row: rowNumber, sku, field: 'name', message: 'Product name is required' }
    };
  }
  if (name.length > 200) {
    return {
      valid: false,
      error: { row: rowNumber, sku, field: 'name', message: 'Product name must be 200 chars or less' }
    };
  }

  const unit = String(rawRow.unit ?? '').trim();
  if (!unit) {
    return { valid: false, error: { row: rowNumber, sku, field: 'unit', message: 'Unit is required' } };
  }
  if (unit.length > 50) {
    return {
      valid: false,
      error: { row: rowNumber, sku, field: 'unit', message: 'Unit must be 50 chars or less' }
    };
  }

  const costRaw = String(rawRow.cost_price ?? '').trim();
  let costPrice = 0;
  if (costRaw) {
    costPrice = Number(costRaw);
    if (!Number.isFinite(costPrice)) {
      return {
        valid: false,
        error: { row: rowNumber, sku, field: 'cost_price', message: 'Cost price must be a number' }
      };
    }
    if (costPrice < 0) {
      return {
        valid: false,
        error: { row: rowNumber, sku, field: 'cost_price', message: 'Cost price cannot be negative' }
      };
    }
  }

  const sellingRaw = String(rawRow.selling_price ?? '').trim();
  let sellingPrice = 0;
  if (sellingRaw) {
    sellingPrice = Number(sellingRaw);
    if (!Number.isFinite(sellingPrice)) {
      return {
        valid: false,
        error: { row: rowNumber, sku, field: 'selling_price', message: 'Selling price must be a number' }
      };
    }
    if (sellingPrice < 0) {
      return {
        valid: false,
        error: { row: rowNumber, sku, field: 'selling_price', message: 'Selling price cannot be negative' }
      };
    }
  }

  const thresholdRaw = String(rawRow.low_stock_threshold ?? '').trim();
  let lowStockThreshold = context.defaultThreshold;
  if (thresholdRaw) {
    if (!/^-?\d+$/.test(thresholdRaw)) {
      return {
        valid: false,
        error: {
          row: rowNumber,
          sku,
          field: 'low_stock_threshold',
          message: 'Low stock threshold must be an integer'
        }
      };
    }
    lowStockThreshold = Number.parseInt(thresholdRaw, 10);
    if (lowStockThreshold < 0) {
      return {
        valid: false,
        error: {
          row: rowNumber,
          sku,
          field: 'low_stock_threshold',
          message: 'Low stock threshold cannot be negative'
        }
      };
    }
  }

  const categoryName = String(rawRow.category ?? '').trim();
  let categoryId: mongoose.Types.ObjectId | null = null;
  if (categoryName) {
    categoryId = context.categoryMap.get(categoryName.toLowerCase()) ?? null;
    if (!categoryId) {
      return {
        valid: false,
        error: {
          row: rowNumber,
          sku,
          field: 'category',
          message: `Category '${categoryName}' not found. Create it first.`
        }
      };
    }
  }

  const description = String(rawRow.description ?? '').trim();
  if (description.length > 2000) {
    return {
      valid: false,
      error: {
        row: rowNumber,
        sku,
        field: 'description',
        message: 'Description must be 2000 chars or less'
      }
    };
  }

  return {
    valid: true,
    row: {
      sku,
      name,
      categoryId,
      unit,
      costPrice,
      sellingPrice,
      lowStockThreshold,
      description,
      tags: parseTags(rawRow.tags)
    }
  };
}

async function insertBatch(rows: ValidatedRow[], tenantId: string, userId: string): Promise<number> {
  if (rows.length === 0) return 0;

  const tenantObjId = new mongoose.Types.ObjectId(tenantId);
  const userObjId = new mongoose.Types.ObjectId(userId);

  try {
    const inserted = await Product.insertMany(
      rows.map((row) => ({
        tenantId: tenantObjId,
        sku: row.sku,
        name: row.name,
        categoryId: row.categoryId,
        unit: row.unit,
        costPrice: row.costPrice,
        sellingPrice: row.sellingPrice,
        lowStockThreshold: row.lowStockThreshold,
        description: row.description,
        tags: row.tags,
        totalStock: 0,
        images: [],
        isActive: true,
        customFields: new Map(),
        createdBy: userObjId,
        updatedBy: userObjId
      })),
      { ordered: false }
    );

    const categoryCounts = new Map<string, { id: mongoose.Types.ObjectId; count: number }>();
    for (const product of inserted) {
      const categoryId = product.categoryId as mongoose.Types.ObjectId | null;
      if (!categoryId) continue;

      const key = categoryId.toString();
      const current = categoryCounts.get(key);
      if (current) {
        current.count += 1;
      } else {
        categoryCounts.set(key, { id: categoryId, count: 1 });
      }
    }

    await Promise.all(
      Array.from(categoryCounts.values()).map((entry) =>
        CategoryModel.findByIdAndUpdate(entry.id, { $inc: { productCount: entry.count } })
      )
    );

    await Promise.allSettled(inserted.map((product) => enqueueProductUpsert(product._id.toString(), tenantId)));

    return inserted.length;
  } catch (error) {
    logger.error('csv_import_batch_insert_failed', {
      tenantId,
      attemptedRows: rows.length,
      error
    });
    return 0;
  }
}

async function emitCompletion(
  tenantId: string,
  jobId: string,
  status: ImportJobStatus,
  successCount: number,
  errorCount: number
): Promise<void> {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('import:completed', {
      jobId,
      status,
      successCount,
      errorCount
    });
  } catch {
    // Best effort only.
  }
}

async function processImport(job: Job<CsvImportPayload>): Promise<void> {
  const { jobId, tenantId, userId, filePath, fileName } = job.data;

  let successCount = 0;
  let errorCount = 0;
  let processedRows = 0;
  const errors: IImportJobError[] = [];

  try {
    await ImportJob.findByIdAndUpdate(jobId, {
      status: 'PROCESSING',
      startedAt: new Date()
    });

    const categories = await CategoryModel.find({ tenantId, isActive: true }).select('_id name').lean();
    const categoryMap = new Map<string, mongoose.Types.ObjectId>();
    for (const category of categories) {
      categoryMap.set(String(category.name).toLowerCase(), category._id as mongoose.Types.ObjectId);
    }

    const existingSkus = await Product.find({ tenantId }).select('sku').lean();
    const existingSkuSet = new Set(existingSkus.map((product) => String(product.sku).toUpperCase()));

    const tenant = await TenantModel.findById(tenantId).select('settings.lowStockThreshold').lean();
    const defaultThreshold = tenant?.settings?.lowStockThreshold ?? 10;

    const parser = fs.createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: false
      })
    );

    const BATCH_SIZE = 100;
    const seenSkusInFile = new Set<string>();
    let batch: ValidatedRow[] = [];
    let rowNumber = 1;

    for await (const rawRow of parser) {
      rowNumber += 1;

      const validated = validateRow(rawRow as Record<string, unknown>, rowNumber, {
        categoryMap,
        existingSkuSet,
        seenSkusInFile,
        defaultThreshold
      });

      if (!validated.valid) {
        errorCount += 1;
        addImportError(errors, validated.error);
        continue;
      }

      seenSkusInFile.add(validated.row.sku);
      batch.push(validated.row);

      if (batch.length >= BATCH_SIZE) {
        const inserted = await insertBatch(batch, tenantId, userId);
        successCount += inserted;
        batch = [];

        processedRows = rowNumber - 1;
        await ImportJob.findByIdAndUpdate(jobId, {
          processedRows,
          successCount,
          errorCount,
          errors
        });
      }
    }

    if (batch.length > 0) {
      const inserted = await insertBatch(batch, tenantId, userId);
      successCount += inserted;
    }

    processedRows = Math.max(0, rowNumber - 1);

    const finalStatus: ImportJobStatus =
      successCount === 0 && errorCount > 0 ? 'FAILED' : errorCount > 0 ? 'PARTIAL' : 'COMPLETED';

    await ImportJob.findByIdAndUpdate(jobId, {
      status: finalStatus,
      processedRows,
      successCount,
      errorCount,
      errors,
      completedAt: new Date()
    });

    enqueueImportCompletionEmail(tenantId, jobId, userId).catch(() => {});

    await emitCompletion(tenantId, jobId, finalStatus, successCount, errorCount);
    logger.info('csv_import_completed', { jobId, tenantId, fileName, successCount, errorCount, status: finalStatus });
  } catch (error) {
    logger.error('csv_import_failed', { jobId, tenantId, fileName, error });

    addImportError(errors, {
      row: -1,
      sku: '',
      field: 'file',
      message: 'Import failed unexpectedly. Please review your file and try again.'
    });

    const failedErrorCount = Math.max(errorCount, 1);

    await ImportJob.findByIdAndUpdate(jobId, {
      status: 'FAILED',
      processedRows,
      successCount,
      errorCount: failedErrorCount,
      errors,
      completedAt: new Date()
    });

    enqueueImportCompletionEmail(tenantId, jobId, userId).catch(() => {});

    await emitCompletion(tenantId, jobId, 'FAILED', successCount, failedErrorCount);
  } finally {
    await fs.promises.unlink(filePath).catch(() => undefined);
  }
}

let csvImportWorker: Worker<CsvImportPayload> | null = null;

export function startCsvImportWorker(): Worker<CsvImportPayload> {
  if (csvImportWorker) {
    return csvImportWorker;
  }

  csvImportWorker = new Worker<CsvImportPayload>('csv-import', processImport, {
    connection: { url: config.REDIS_URL },
    concurrency: 2
  });

  csvImportWorker.on('error', (error) => {
    logger.error('csv_import_worker_error', { error });
  });

  logger.info('csv_import_worker_started');
  return csvImportWorker;
}
