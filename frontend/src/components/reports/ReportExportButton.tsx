import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/router/guards/PermissionGuard';
import type { Permission } from '@/types';

interface ReportExportButtonProps {
  onExport: () => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
  estimatedRows?: number;
  permission?: Permission;
}

/**
 * Reusable export button for reports
 * Handles loading state and error notifications
 */
export function ReportExportButton({
  onExport,
  disabled = false,
  disabledReason,
  estimatedRows = 0,
  permission = 'report.export'
}: ReportExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport();
    } catch (error) {
      toast.error('Export failed. Please try again.');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const isDisabled = disabled || isExporting;
  const rowsHint = estimatedRows > 0 ? `Export ${estimatedRows.toLocaleString()} rows as CSV` : 'Export CSV';

  const button = (
    <Button
      onClick={handleExport}
      disabled={isDisabled}
      variant="outline"
      size="sm"
      className="gap-2"
      aria-label={rowsHint}
      aria-busy={isExporting}
      title={disabled && disabledReason ? disabledReason : rowsHint}
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Export CSV
        </>
      )}
    </Button>
  );

  return (
    <PermissionGuard permission={permission} fallback={<div />}>
      {/* Disabled buttons have pointer-events:none, so the title tooltip never
          fires on the button itself; the wrapper carries it (and visible text). */}
      {disabled && disabledReason ? (
        <span className="inline-flex flex-col items-end gap-1" title={disabledReason}>
          {button}
          <span className="text-xs text-muted-foreground">{disabledReason}</span>
        </span>
      ) : (
        button
      )}
    </PermissionGuard>
  );
}
