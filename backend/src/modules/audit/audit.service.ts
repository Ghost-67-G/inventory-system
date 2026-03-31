import mongoose from 'mongoose';
import { AuditLogModel } from '../../models/AuditLog';
import type { ListAuditLogsQuery } from './audit.schema';

function encodeCursor(createdAt: Date, id: string): string {
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

    return { createdAt, id: new mongoose.Types.ObjectId(parsed.id) };
  } catch {
    return null;
  }
}

export async function listAuditLogs(tenantId: string, query: ListAuditLogsQuery) {
  const parsedLimit = query.limit ? Number(query.limit) : 50;
  const limit = Math.min(Math.max(parsedLimit, 1), 100);

  const filter: Record<string, unknown> = {
    tenantId: new mongoose.Types.ObjectId(tenantId)
  };

  if (query.entityType) {
    filter.entityType = query.entityType;
  }

  if (query.entityId) {
    filter.entityId = new mongoose.Types.ObjectId(query.entityId);
  }

  if (query.performedBy) {
    filter.performedBy = new mongoose.Types.ObjectId(query.performedBy);
  }

  if (query.action) {
    filter.action = query.action;
  }

  if (query.dateFrom || query.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (query.dateFrom) {
      dateFilter.$gte = new Date(query.dateFrom);
    }
    if (query.dateTo) {
      dateFilter.$lte = new Date(query.dateTo);
    }
    filter.createdAt = dateFilter;
  }

  const parsedCursor = query.cursor ? parseCursor(query.cursor) : null;
  if (parsedCursor) {
    filter.$or = [
      { createdAt: { $lt: parsedCursor.createdAt } },
      { createdAt: parsedCursor.createdAt, _id: { $lt: parsedCursor.id } }
    ];
  }

  const logs = await AuditLogModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = logs.length > limit;
  if (hasMore) {
    logs.pop();
  }

  const last = logs[logs.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, String(last._id)) : null;

  return {
    logs,
    nextCursor,
    hasMore
  };
}

export async function getEntityHistory(tenantId: string, entityType: string, entityId: string) {
  const logs = await AuditLogModel.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    entityType,
    entityId: new mongoose.Types.ObjectId(entityId)
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return { logs };
}