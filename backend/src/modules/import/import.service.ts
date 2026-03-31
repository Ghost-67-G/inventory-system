import fs from 'fs';
import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ImportJob } from '../../models/ImportJob';
import { enqueueCsvImport } from '../../queues/jobs/csvImport.job';
import { CategoryModel } from '../../models/Category';
import type { ListImportJobsQuery } from './import.schema';

const IMPORT_ACTIVE_STATUSES = ['PENDING', 'PROCESSING'] as const;

function escapeCsvCell(value: string | number): string {
  const stringified = String(value ?? '');
  if (/[",\n\r]/.test(stringified)) {
    return `"${stringified.replace(/"/g, '""')}"`;
  }
  return stringified;
}

function buildCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString('base64');
}

function parseCursor(cursor: string): { createdAt: Date; id: mongoose.Types.ObjectId } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      createdAt: string;
      id: string;
    };

    if (!parsed.createdAt || !parsed.id || !mongoose.Types.ObjectId.isValid(parsed.id)) {
      return null;
    }

    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return {
      createdAt,
      id: new mongoose.Types.ObjectId(parsed.id)
    };
  } catch {
    return null;
  }
}

function countDataRows(csvContent: string): number {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return Math.max(0, lines.length - 1);
}

export async function createImportJob(
  tenantId: string,
  userId: string,
  file: Express.Multer.File | undefined
): Promise<{ jobId: string; status: 'PENDING'; totalRows: number }> {
  if (!file) {
    throw new ApiError(400, 'CSV file is required');
  }

  let rowCount = 0;
  try {
    const content = await fs.promises.readFile(file.path, 'utf8');
    rowCount = countDataRows(content);

    if (rowCount > 10000) {
      throw new ApiError(400, 'File exceeds 10,000 row limit');
    }

    if (rowCount === 0) {
      throw new ApiError(400, 'File is empty or contains only headers');
    }

    const importJob = await ImportJob.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      createdBy: new mongoose.Types.ObjectId(userId),
      status: 'PENDING',
      fileName: file.originalname,
      totalRows: rowCount,
      processedRows: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    });

    await enqueueCsvImport({
      jobId: importJob._id.toString(),
      tenantId,
      userId,
      filePath: file.path,
      fileName: file.originalname
    });

    return {
      jobId: importJob._id.toString(),
      status: 'PENDING',
      totalRows: rowCount
    };
  } catch (error) {
    await fs.promises.unlink(file.path).catch(() => undefined);
    throw error;
  }
}

export async function getImportJob(tenantId: string, jobId: string) {
  const job = await ImportJob.findOne({
    _id: new mongoose.Types.ObjectId(jobId),
    tenantId: new mongoose.Types.ObjectId(tenantId)
  }).lean();

  if (!job) {
    throw new ApiError(404, 'Import job not found');
  }

  return job;
}

export async function listImportJobs(tenantId: string, query: ListImportJobsQuery) {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
  const filter: Record<string, unknown> = {
    tenantId: new mongoose.Types.ObjectId(tenantId)
  };

  const parsedCursor = query.cursor ? parseCursor(query.cursor) : null;
  if (query.cursor && !parsedCursor) {
    throw new ApiError(400, 'Invalid cursor');
  }

  if (parsedCursor) {
    filter.$or = [
      { createdAt: { $lt: parsedCursor.createdAt } },
      { createdAt: parsedCursor.createdAt, _id: { $lt: parsedCursor.id } }
    ];
  }

  const jobs = await ImportJob.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = jobs.length > limit;
  if (hasMore) {
    jobs.pop();
  }

  const last = jobs[jobs.length - 1];
  const nextCursor = hasMore && last ? buildCursor(last.createdAt, String(last._id)) : null;

  return {
    jobs,
    nextCursor,
    hasMore
  };
}

export async function getActiveImportJob(tenantId: string) {
  return ImportJob.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    status: { $in: IMPORT_ACTIVE_STATUSES }
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function buildTemplateCsv(tenantId: string): Promise<string> {
  const headers = [
    'sku',
    'name',
    'category',
    'unit',
    'cost_price',
    'selling_price',
    'low_stock_threshold',
    'description',
    'tags'
  ];

  const categories = await CategoryModel.find({ tenantId, isActive: true })
    .select('name')
    .sort({ name: 1 })
    .limit(3)
    .lean();

  const categoryNames = categories.map((category) => String(category.name));

  const examples = [
    [
      'PROD-001',
      'USB-C Cable 2m',
      categoryNames[0] ?? 'Cables & Adapters',
      'pcs',
      3.5,
      12.99,
      50,
      'High quality braided cable',
      'usb,cable,2m'
    ],
    [
      'PROD-002',
      'Wireless Mouse',
      categoryNames[1] ?? categoryNames[0] ?? 'Keyboards & Mice',
      'pcs',
      18,
      39.99,
      20,
      'Ergonomic wireless mouse',
      'mouse,wireless'
    ],
    [
      'PROD-003',
      'A4 Printer Paper (500 sheets)',
      categoryNames[2] ?? categoryNames[0] ?? 'Office Supplies',
      'ream',
      4.2,
      8.5,
      30,
      'Multipurpose white paper',
      'paper,office,a4'
    ]
  ];

  const rows = [headers, ...examples].map((row) => row.map(escapeCsvCell).join(','));
  return `${rows.join('\n')}\n`;
}
