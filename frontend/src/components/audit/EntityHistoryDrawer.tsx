import { AuditLogEntry } from '@/components/audit/AuditLogEntry';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { useEntityHistory } from '@/hooks/useAudit';
import type { AuditEntityType } from '@/types';

interface EntityHistoryDrawerProps {
  open: boolean;
  onClose(): void;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
}

export function EntityHistoryDrawer({
  open,
  onClose,
  entityType,
  entityId,
  entityName
}: EntityHistoryDrawerProps) {
  const { data: logs = [], isLoading } = useEntityHistory(entityType, entityId);

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{entityName} — Change history</SheetTitle>
          <SheetDescription>Recent changes for this item.</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3">
          {isLoading ? <p className="text-sm text-slate-500">Loading history...</p> : null}

          {!isLoading && logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No changes recorded yet
            </div>
          ) : null}

          {logs.map((log) => (
            <AuditLogEntry key={log._id} log={log} compact />
          ))}

          {logs.length >= 50 ? (
            <div className="pt-2 text-center text-xs text-slate-500">
              Showing latest 50 entries.
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
