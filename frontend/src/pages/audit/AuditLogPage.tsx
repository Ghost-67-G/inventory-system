import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { AuditLogEntry } from '@/components/audit/AuditLogEntry';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useAuditLogs } from '@/hooks/useAudit';
import { useUsers } from '@/hooks/useUsers';
import type { AuditAction, AuditEntityType } from '@/types';

const ENTITY_OPTIONS: Array<{ value: '' | AuditEntityType; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'product', label: 'Products' },
  { value: 'category', label: 'Categories' },
  { value: 'warehouse', label: 'Warehouses' },
  { value: 'user', label: 'Users' },
  { value: 'stock', label: 'Stock' },
  { value: 'settings', label: 'Settings' }
];

const ACTIONS_BY_ENTITY: Record<AuditEntityType, AuditAction[]> = {
  product: ['product.created', 'product.updated', 'product.deleted'],
  category: ['category.created', 'category.updated', 'category.deleted'],
  warehouse: ['warehouse.created', 'warehouse.updated', 'warehouse.deactivated', 'warehouse.reactivated'],
  user: ['user.invited', 'user.role_changed', 'user.deactivated', 'user.reactivated'],
  stock: ['stock.adjusted'],
  settings: ['settings.updated']
};

function toActionLabel(action: AuditAction): string {
  return action.split('.')[1].replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

export function AuditLogPage() {
  const [entityType, setEntityType] = useState<'' | AuditEntityType>('');
  const [action, setAction] = useState<'' | AuditAction>('');
  const [performedBy, setPerformedBy] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { isMobile } = useWindowSize();

  const { data: usersData } = useUsers({ page: 1, limit: 100 });
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useAuditLogs({
    entityType: entityType || undefined,
    action: action || undefined,
    performedBy: performedBy || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 50
  });

  const logs = useMemo(() => data?.pages.flatMap((page) => page.logs) ?? [], [data]);

  const availableActions = entityType ? ACTIONS_BY_ENTITY[entityType] : Object.values(ACTIONS_BY_ENTITY).flat();

  const clearFilters = () => {
    setEntityType('');
    setAction('');
    setPerformedBy('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Complete history of changes made by your team" />

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-6">
        <select
          className="h-11 rounded-lg border border-input px-2 text-sm md:h-9"
          value={entityType}
          onChange={(event) => {
            const next = event.target.value as '' | AuditEntityType;
            setEntityType(next);
            setAction('');
          }}
        >
          {ENTITY_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select
          className="h-11 rounded-lg border border-input px-2 text-sm md:h-9"
          value={action}
          onChange={(event) => setAction(event.target.value as '' | AuditAction)}
        >
          <option value="">All actions</option>
          {availableActions.map((option) => (
            <option key={option} value={option}>{toActionLabel(option)}</option>
          ))}
        </select>

        <select
          className="h-11 rounded-lg border border-input px-2 text-sm md:h-9"
          value={performedBy}
          onChange={(event) => setPerformedBy(event.target.value)}
        >
          <option value="">Performed by</option>
          {(usersData?.users ?? []).map((user) => (
            <option key={user._id} value={user._id}>{user.name}</option>
          ))}
        </select>

        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />

        <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
      </div>

      <div className="space-y-3">
        {isLoading ? <div className="text-sm text-muted-foreground">Loading audit events...</div> : null}

        {!isLoading && logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {entityType || action || performedBy || dateFrom || dateTo
              ? 'No events match your filters'
              : 'No audit events found'}
          </div>
        ) : null}

        {isMobile
          ? logs.map((log) => <AuditLogEntry key={log._id} log={log} compact />)
          : logs.map((log) => <AuditLogEntry key={log._id} log={log} />)}
      </div>

      {hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">Audit logs are retained for 90 days.</p>
    </div>
  );
}
