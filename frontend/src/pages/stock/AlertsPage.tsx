import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { WarehouseBadge } from '@/components/shared/WarehouseBadge';
import StockBadge from '@/components/shared/StockBadge';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useAcknowledgeAlert, useAlerts, useBulkAcknowledge, usePendingAlertCount } from '@/hooks/useStock';
import { usePermission } from '@/hooks/usePermission';
import type { IStockAlert } from '@/types';

export function AlertsPage() {
  const [tab, setTab] = useState<'PENDING' | 'ACKNOWLEDGED' | 'ALL'>('PENDING');
  const [selected, setSelected] = useState<IStockAlert[]>([]);
  const { isMobile, isTablet } = useWindowSize();
  const { canDo } = usePermission();

  const alertsQuery = useAlerts({ status: tab === 'ALL' ? undefined : tab });
  const countQuery = usePendingAlertCount();

  const acknowledgeMutation = useAcknowledgeAlert();
  const bulkMutation = useBulkAcknowledge();

  const alerts = useMemo(() => alertsQuery.data?.pages.flatMap((page) => page.alerts) ?? [], [alertsQuery.data?.pages]);

  const columns = useMemo<ColumnDef<IStockAlert>[]>(
    () => [
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
              row.original.status === 'PENDING'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            }`}
          >
            {row.original.status === 'PENDING' ? 'Pending' : 'Acknowledged'}
          </span>
        )
      },
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.product?.name ?? '-'}</div>
            <div className="text-xs text-muted-foreground">{row.original.product?.sku ?? '-'}</div>
          </div>
        )
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: ({ row }) =>
          row.original.warehouse ? (
            <WarehouseBadge code={row.original.warehouse.code} name={row.original.warehouse.name} size="sm" />
          ) : (
            '-'
          )
      },
      {
        id: 'currentStock',
        header: 'Current stock',
        cell: ({ row }) => (
          <StockBadge
            stock={row.original.currentStock}
            threshold={row.original.threshold}
            unit={row.original.product?.unit ?? ''}
          />
        )
      },
      {
        id: 'threshold',
        header: 'Threshold',
        cell: ({ row }) => `${row.original.threshold} ${row.original.product?.unit ?? ''}`
      },
      {
        id: 'created',
        header: 'Created',
        cell: ({ row }) => formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) =>
          row.original.status === 'PENDING' && canDo('alert.acknowledge') ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                acknowledgeMutation.mutate(row.original._id);
              }}
            >
              Acknowledge
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )
      }
    ],
    [acknowledgeMutation, canDo]
  );

  const pendingVisible = alerts.filter((alert) => alert.status === 'PENDING');

  return (
    <div className="space-y-4">
      <PageHeader title="Stock alerts" subtitle={`${countQuery.data ?? 0} pending alerts`}>
        {canDo('alert.acknowledge') && pendingVisible.length > 0 ? (
          <Button
            variant="outline"
            onClick={() => {
              const ids = pendingVisible.map((item) => item._id);
              if (ids.length > 10 && !window.confirm(`Acknowledge ${ids.length} alerts?`)) {
                return;
              }
              bulkMutation.mutate(ids);
            }}
          >
            Acknowledge all
          </Button>
        ) : null}
      </PageHeader>

      <div className="flex gap-2">
        {(['PENDING', 'ACKNOWLEDGED', 'ALL'] as const).map((status) => (
          <Button
            key={status}
            variant={tab === status ? 'default' : 'outline'}
            onClick={() => setTab(status)}
          >
            {status === 'ALL' ? 'All' : status === 'PENDING' ? 'Pending' : 'Acknowledged'}
          </Button>
        ))}
      </div>

      {selected.length > 0 && canDo('alert.acknowledge') ? (
        <div className="rounded-md border bg-amber-50 p-3 text-sm flex items-center justify-between">
          <span>{selected.length} selected</span>
          <Button
            size="sm"
            onClick={() => bulkMutation.mutate(selected.map((item) => item._id))}
          >
            Acknowledge selected
          </Button>
        </div>
      ) : null}

      {isMobile ? (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <article key={alert._id} className="min-h-20 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{alert.product?.name ?? '-'}</p>
                  <p className="text-xs text-muted-foreground">{alert.warehouse?.name ?? '-'}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">{alert.currentStock}</p>
                  <p className="text-xs text-muted-foreground">/ {alert.threshold} threshold</p>
                </div>
                {alert.status === 'PENDING' && canDo('alert.acknowledge') ? (
                  <Button className="h-11 min-h-11" onClick={() => acknowledgeMutation.mutate(alert._id)}>
                    Acknowledge
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <DataTable<IStockAlert>
          columns={columns}
          data={alerts}
          enableRowSelection={canDo('alert.acknowledge')}
          onSelectionChange={(rows) => setSelected(rows)}
          getRowId={(row) => row._id}
          isLoading={alertsQuery.isLoading}
          isFetchingNextPage={alertsQuery.isFetchingNextPage}
          hasNextPage={alertsQuery.hasNextPage}
          onFetchNextPage={() => void alertsQuery.fetchNextPage()}
          emptyMessage={
            tab === 'PENDING'
              ? 'All caught up! No pending alerts.'
              : tab === 'ACKNOWLEDGED'
                ? 'No acknowledged alerts yet.'
                : 'No alerts found.'
          }
          hiddenColumnIds={isTablet ? ['threshold'] : []}
          maxHeight="calc(100dvh - 260px)"
        />
      )}
    </div>
  );
}
