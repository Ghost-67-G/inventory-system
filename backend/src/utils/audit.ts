import type { Request } from 'express';
import type { AuditAction, AuditEntityType, IAuditChange } from '../models/AuditLog';
import { AuditLogModel } from '../models/AuditLog';
import { logger } from './logger';

export interface AuditContext {
  performedByName: string;
  performedByEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface CreateAuditLogDto {
  tenantId: string;
  performedBy: string;
  performedByName: string;
  performedByEmail: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityName: string;
  changes?: IAuditChange[];
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const IGNORED_FIELDS = new Set(['updatedAt', 'updatedBy', '__v']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value && typeof value === 'object') {
    if ('toHexString' in (value as Record<string, unknown>) && typeof (value as { toHexString: () => string }).toHexString === 'function') {
      return (value as { toHexString: () => string }).toHexString();
    }
    if ('toString' in (value as Record<string, unknown>) && (value as { toString: () => string }).toString() !== '[object Object]') {
      return (value as { toString: () => string }).toString();
    }
  }
  return value;
}

function isEqualValue(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  const normalizedA = normalizeValue(a);
  const normalizedB = normalizeValue(b);

  if (normalizedA === normalizedB) {
    return true;
  }

  if (Array.isArray(normalizedA) || Array.isArray(normalizedB) || isPlainObject(normalizedA) || isPlainObject(normalizedB)) {
    return JSON.stringify(normalizedA) === JSON.stringify(normalizedB);
  }

  return false;
}

function diffRecursive(before: unknown, after: unknown, path: string, result: IAuditChange[]): void {
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!isEqualValue(before, after)) {
      result.push({ field: path, oldValue: before, newValue: after });
    }
    return;
  }

  if (isPlainObject(before) || isPlainObject(after)) {
    const beforeObj = isPlainObject(before) ? before : {};
    const afterObj = isPlainObject(after) ? after : {};
    const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

    for (const key of keys) {
      if (IGNORED_FIELDS.has(key)) {
        continue;
      }

      const nextPath = path ? `${path}.${key}` : key;
      diffRecursive(beforeObj[key], afterObj[key], nextPath, result);
    }
    return;
  }

  if (!isEqualValue(before, after)) {
    result.push({ field: path, oldValue: before, newValue: after });
  }
}

export function diffObjects(before: Record<string, unknown>, after: Record<string, unknown>): IAuditChange[] {
  const result: IAuditChange[] = [];
  diffRecursive(before, after, '', result);
  return result.filter((change) => change.field.length > 0);
}

export function extractRequestMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwardedFor = req.headers['x-forwarded-for'];

  let forwardedIp: string | null = null;
  if (Array.isArray(forwardedFor)) {
    forwardedIp = forwardedFor[0]?.split(',')[0]?.trim() ?? null;
  } else if (typeof forwardedFor === 'string') {
    forwardedIp = forwardedFor.split(',')[0]?.trim() ?? null;
  }

  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

  return {
    ipAddress: req.ip ?? forwardedIp ?? null,
    userAgent
  };
}

export function createAuditLog(data: CreateAuditLogDto): Promise<void> {
  return AuditLogModel.create({
    tenantId: data.tenantId,
    performedBy: data.performedBy,
    performedByName: data.performedByName,
    performedByEmail: data.performedByEmail,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId ?? null,
    entityName: data.entityName,
    changes: data.changes ?? [],
    metadata: data.metadata ?? {},
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null
  })
    .then(() => undefined)
    .catch((error) => {
      logger.error('audit_log_failed', {
        error,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        tenantId: data.tenantId
      });
    });
}