import { useMemo, useState } from 'react';
import { Boxes, FileText, Package, Settings, Tag, Truck, User, Warehouse } from 'lucide-react';
import type { AuditAction, AuditChange, IAuditLog } from '@/types';

interface AuditLogEntryProps {
  log: IAuditLog;
  compact?: boolean;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date).replace(',', ' ·');
}

function formatFieldName(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    if (field.toLowerCase().includes('price')) {
      return value.toFixed(2);
    }
    return String(value);
  }

  if (typeof value === 'string') {
    return value.length > 80 ? `${value.slice(0, 80)}...` : value;
  }

  return JSON.stringify(value);
}

function getActionBadgeClass(action: AuditAction): string {
  if (action.includes('created')) return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
  if (action.includes('updated')) return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
  if (action.includes('deleted')) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
  if (action.includes('deactivated')) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
  if (action.includes('reactivated')) return 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800';
  if (action.includes('role_changed')) return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
  if (action.includes('adjusted')) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
  return 'bg-muted text-muted-foreground border-border';
}

function getActionLabel(action: AuditAction): string {
  return action.split('.').join(' ').replace(/_/g, ' ');
}

function getEntityIcon(entityType: IAuditLog['entityType']) {
  switch (entityType) {
    case 'product':
      return Package;
    case 'category':
      return Tag;
    case 'warehouse':
      return Warehouse;
    case 'user':
      return User;
    case 'stock':
      return Boxes;
    case 'settings':
      return Settings;
    case 'supplier':
      return Truck;
    case 'purchase_order':
      return FileText;
    default:
      return Package;
  }
}

function UserInitial({ name }: { name: string }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
      {initial}
    </span>
  );
}

function ChangeRow({ change }: { change: AuditChange }) {
  const oldValue = formatValue(change.field, change.oldValue);
  const newValue = formatValue(change.field, change.newValue);

  return (
    <div className="grid grid-cols-1 gap-2 border-t border-border py-2 text-sm md:grid-cols-3">
      <div className="text-muted-foreground">{formatFieldName(change.field)}</div>
      <div title={oldValue} className="truncate text-muted-foreground">{oldValue}</div>
      <div title={newValue} className="truncate font-medium text-foreground">{newValue}</div>
    </div>
  );
}

export function AuditLogEntry({ log, compact = false }: AuditLogEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getEntityIcon(log.entityType);
  const actionClass = getActionBadgeClass(log.action);
  const actionLabel = useMemo(() => getActionLabel(log.action), [log.action]);
  // Older/partial log rows may omit `changes`; never assume the array exists.
  const changes = log.changes ?? [];

  if (compact) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(log.createdAt)}</span>
          <span className={`truncate rounded-full border px-2 py-0.5 text-[11px] font-medium ${actionClass}`}>{actionLabel}</span>
        </div>
        {log.entityName ? (
          <div className="mt-2 flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{log.entityName}</span>
          </div>
        ) : null}
        <div className="mt-1 truncate text-sm text-foreground">by {log.performedByName}</div>
        <div className="mt-1 text-xs text-muted-foreground">{changes.length} fields changed</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="w-full p-4 text-left"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
          <div className="md:col-span-2 text-xs text-muted-foreground">{formatTimestamp(log.createdAt)}</div>
          <div className="md:col-span-2 flex min-w-0 items-center gap-2">
            <UserInitial name={log.performedByName} />
            <span className="truncate text-sm text-foreground">{log.performedByName}</span>
          </div>
          <div className="md:col-span-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${actionClass}`}>{actionLabel}</span>
          </div>
          <div className="md:col-span-3 flex min-w-0 items-center gap-2 text-sm text-foreground">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{log.entityName}</span>
          </div>
          <div className="md:col-span-2 text-sm text-muted-foreground">{changes.length} fields changed</div>
          <div className="md:col-span-1 truncate text-right text-xs text-muted-foreground">{log.ipAddress ?? ''}</div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-border px-4 pb-2">
          {changes.length > 0 ? (
            <div className="pt-2">
              {changes.map((change, index) => (
                <ChangeRow key={`${log._id}-${change.field}-${index}`} change={change} />
              ))}
            </div>
          ) : (
            <div className="py-3 text-sm text-muted-foreground">No field-level changes captured for this action.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
