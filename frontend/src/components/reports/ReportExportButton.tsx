import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
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
      alert('Export failed. Please try again.');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const button = (
    <Button
      onClick={handleExport}
      disabled={disabled || isExporting}
      variant="outline"
      size="sm"
      className="gap-2"
      title={disabledReason || ''}
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
      {button}
    </PermissionGuard>
  );
}
