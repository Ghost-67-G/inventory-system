import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Upload,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { importApi } from '@/api/endpoints/import';
import { useImportJob, useImportJobs, useUploadCsv } from '@/hooks/useImport';
import { formatRelativeTime } from '@/lib/formatting';
import type { IImportJob, ImportError } from '@/types';
import { useWindowSize } from '@/hooks/useWindowSize';

type TerminalStatus = 'COMPLETED' | 'FAILED' | 'PARTIAL';

const COLUMN_INFO = [
  { name: 'sku', required: 'Required', description: 'Unique SKU, max 100 characters.' },
  { name: 'name', required: 'Required', description: 'Product name, max 200 characters.' },
  {
    name: 'category',
    required: 'Optional',
    description: 'Must match an existing category name, case-insensitive.'
  },
  { name: 'unit', required: 'Required', description: 'Unit label such as pcs, box, kg. Max 50 characters.' },
  { name: 'cost_price', required: 'Optional', description: 'Number >= 0. Defaults to 0.' },
  { name: 'selling_price', required: 'Optional', description: 'Number >= 0. Defaults to 0.' },
  {
    name: 'low_stock_threshold',
    required: 'Optional',
    description: 'Integer >= 0. Defaults to tenant low stock threshold setting.'
  },
  { name: 'description', required: 'Optional', description: 'Long description, max 2000 characters.' },
  {
    name: 'tags',
    required: 'Optional',
    description: 'Comma-separated tags in one cell, for example usb,cable,2m.'
  }
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateRowCount(file: File): number {
  return Math.max(1, Math.round(file.size / 120));
}

function sortErrors(errors: ImportError[]): ImportError[] {
  return [...errors].sort((a, b) => {
    if (a.row === -1 && b.row !== -1) return 1;
    if (b.row === -1 && a.row !== -1) return -1;
    return a.row - b.row;
  });
}

function triggerErrorDownload(errors: ImportError[]): void {
  const rows = ['row,sku,field,message'];
  for (const error of sortErrors(errors)) {
    const fields = [error.row, error.sku, error.field, error.message].map((value) => {
      const stringified = String(value ?? '');
      if (/[",\n\r]/.test(stringified)) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    });
    rows.push(fields.join(','));
  }

  const content = `${rows.join('\n')}\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function statusBadge(job: IImportJob) {
  if (job.status === 'PENDING') {
    return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Queued</span>;
  }

  if (job.status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing...
      </span>
    );
  }

  if (job.status === 'COMPLETED') {
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</span>;
  }

  if (job.status === 'PARTIAL') {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Partial</span>;
  }

  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">Failed</span>;
}

export function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localFileError, setLocalFileError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | undefined>(undefined);
  const [historyJobs, setHistoryJobs] = useState<IImportJob[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const { isMobile } = useWindowSize();
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);

  const { upload, isUploading, uploadProgress, uploadError } = useUploadCsv();
  const activeJobQuery = useImportJob(activeJobId);
  const historyQuery = useImportJobs({ cursor: historyCursor, limit: 10 });

  useEffect(() => {
    const data = historyQuery.data;
    if (!data) return;

    setHistoryHasMore(data.hasMore);
    setHistoryNextCursor(data.nextCursor);

    setHistoryJobs((previous) => {
      const next = historyCursor ? [...previous, ...data.jobs] : data.jobs;
      const byId = new Map<string, IImportJob>();
      for (const job of next) byId.set(job._id, job);
      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [historyCursor, historyQuery.data]);

  useEffect(() => {
    const currentJob = activeJobQuery.data?.job as IImportJob | undefined;
    if (!currentJob) return;

    if (currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED' || currentJob.status === 'PARTIAL') {
      setHistoryCursor(undefined);
    }
  }, [activeJobQuery.data?.job]);

  const currentJob = activeJobQuery.data?.job as IImportJob | undefined;
  const processingPct = currentJob
    ? Math.min(100, Math.round((currentJob.processedRows / Math.max(1, currentJob.totalRows)) * 100))
    : 0;

  const terminalStatus =
    currentJob?.status === 'COMPLETED' || currentJob?.status === 'FAILED' || currentJob?.status === 'PARTIAL'
      ? (currentJob.status as TerminalStatus)
      : null;
  const finishedJob = terminalStatus ? currentJob : null;

  const displayedErrors = useMemo(() => {
    if (!currentJob?.errorCount) return [];
    return sortErrors(currentJob.errors || []);
  }, [currentJob?.errorCount, currentJob?.errors]);

  const handleTemplateDownload = async () => {
    try {
      await importApi.downloadTemplate();
    } catch {
      toast.error('Failed to download template');
    }
  };

  const validateFile = (file: File): boolean => {
    const isCsvExt = file.name.toLowerCase().endsWith('.csv');
    if (!isCsvExt) {
      setLocalFileError('Only .csv files are allowed.');
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLocalFileError('File is too large. Maximum size is 5MB.');
      return false;
    }

    setLocalFileError(null);
    return true;
  };

  const onFileSelected = (file: File | null) => {
    if (!file) return;
    if (!validateFile(file)) return;
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const result = await upload(selectedFile);
      setActiveJobId(result.jobId);
      setSelectedFile(null);
      toast.success('Import job created. Processing started.');
    } catch {
      // Error message is shown in uploadError.
    }
  };

  const resetUploader = () => {
    setSelectedFile(null);
    setActiveJobId(null);
    setLocalFileError(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Import products" subtitle="Upload a CSV file to add products in bulk">
        <Link className="text-sm text-muted-foreground hover:text-foreground" to="/products">
          {'<- Products'}
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">1. Download the template</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use our CSV template to ensure your data is formatted correctly.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => void handleTemplateDownload()}>
              <Download className="mr-2 h-4 w-4" />
              Download template CSV
            </Button>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">2. Prepare your data</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>- Required columns: sku, name, unit</li>
              <li>- Categories must already exist in your account</li>
              <li>- SKUs must be unique - duplicates will be skipped</li>
              <li>- Maximum 10,000 rows per file, 5MB file size limit</li>
              <li>- Row 1 must be the header row</li>
            </ul>

            <details className="mt-4 rounded-lg border border-border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                {'View all column descriptions ->'}
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Column</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COLUMN_INFO.map((column) => (
                      <tr key={column.name} className="border-t border-border">
                        <td className="px-4 py-2 font-mono text-xs text-foreground">{column.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{column.required}</td>
                        <td className="px-4 py-2 text-muted-foreground">{column.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">3. Upload your file</h2>

            {!isUploading && !currentJob?.status && (
              <div className="mt-4 space-y-3">
                {!selectedFile ? (
                  <button
                    className={`flex ${isMobile ? 'h-30' : 'h-45'} w-full flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
                      dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-border bg-muted/40 hover:bg-muted/60'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      onFileSelected(event.dataTransfer.files?.[0] ?? null);
                    }}
                    type="button"
                  >
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Drop your CSV file here</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                  </button>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                        </div>
                      </div>
                      <button
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => setSelectedFile(null)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                <input
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
                  ref={fileInputRef}
                  type="file"
                />

                {localFileError ? <p className="text-sm text-red-600">{localFileError}</p> : null}
                {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}

                {selectedFile ? (
                  <div>
                    <Button className="w-full" onClick={() => void handleUpload()}>
                      Import {estimateRowCount(selectedFile).toLocaleString()} rows
                    </Button>
                    <button
                      className="mt-2 w-full text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedFile(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {isUploading ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Uploading... {uploadProgress}%</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : null}

            {currentJob && (currentJob.status === 'PENDING' || currentJob.status === 'PROCESSING') ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Processing your import...</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${processingPct}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentJob.processedRows.toLocaleString()} of {currentJob.totalRows.toLocaleString()} rows processed
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentJob.successCount.toLocaleString()} added - {currentJob.errorCount.toLocaleString()} errors
                </p>
              </div>
            ) : null}

            {terminalStatus === 'COMPLETED' ? (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/20">
                <p className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  Import complete
                </p>
                <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                  {finishedJob?.successCount.toLocaleString()} products added successfully
                </p>
                {(finishedJob?.errorCount ?? 0) > 0 ? (
                  <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                    {finishedJob?.errorCount.toLocaleString()} rows had errors - see below
                  </p>
                ) : null}
                <Button className="mt-3" variant="outline" onClick={resetUploader}>
                  Import another file
                </Button>
              </div>
            ) : null}

            {terminalStatus === 'FAILED' ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                  <XCircle className="h-5 w-5" />
                  Import failed
                </p>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400">All rows had errors - no products were added</p>
                <Button className="mt-3" variant="outline" onClick={resetUploader}>
                  Import another file
                </Button>
              </div>
            ) : null}

            {terminalStatus === 'PARTIAL' ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                  Import finished with errors
                </p>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                  {finishedJob?.successCount.toLocaleString()} products added, {finishedJob?.errorCount.toLocaleString()} rows skipped
                </p>
                <Button className="mt-3" variant="outline" onClick={resetUploader}>
                  Import another file
                </Button>
              </div>
            ) : null}
          </section>

          {currentJob && currentJob.errorCount > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Error report</h2>
                  <p className="text-sm text-muted-foreground">These rows were not imported. Fix the issues and re-upload.</p>
                </div>
                <Button variant="outline" onClick={() => triggerErrorDownload(displayedErrors)}>
                  Download error report
                </Button>
              </div>

              {displayedErrors.length === 101 && displayedErrors[displayedErrors.length - 1]?.row === -1 ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Only showing first 100 errors. Fix these and re-upload.
                </div>
              ) : null}

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Row #</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Error message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedErrors.map((error, index) => (
                      <tr className="border-t border-border" key={`${error.row}-${error.field}-${index}`}>
                        <td className="px-3 py-2 text-foreground">{error.row === -1 ? '-' : error.row}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{error.sku || '-'}</td>
                        <td className="px-3 py-2 text-foreground">{error.field}</td>
                        <td className="px-3 py-2 text-foreground">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Import history</h2>

          {historyQuery.isLoading && historyJobs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
          ) : null}

          {!historyQuery.isLoading && historyJobs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No imports yet</p>
          ) : null}

          <div className="mt-4 space-y-3">
            {(isMobile ? historyJobs.slice(0, 5) : historyJobs).map((job) => (
              <div className="rounded-lg border border-border p-3" key={job._id}>
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedJobId((previous) => (previous === job._id ? null : job._id))}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="line-clamp-1 text-sm font-medium text-foreground">{job.fileName}</p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(job.createdAt)}</p>
                    </div>
                    {statusBadge(job)}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {job.successCount.toLocaleString()}/{job.totalRows.toLocaleString()} rows imported
                  </p>
                </button>

                {expandedJobId === job._id && job.errors.length > 0 ? (
                  <div className="mt-3 max-h-40 overflow-y-auto rounded border border-border bg-muted/50 p-2">
                    {sortErrors(job.errors).map((error, index) => (
                      <p className="text-xs text-muted-foreground" key={`${error.row}-${error.field}-${index}`}>
                        Row {error.row === -1 ? '-' : error.row}: {error.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {isMobile && historyJobs.length > 5 ? (
            <button
              type="button"
              className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => setHistoryCursor(historyNextCursor ?? undefined)}
            >
              View all
            </button>
          ) : null}

          {!isMobile && historyHasMore ? (
            <Button
              className="mt-4 w-full"
              onClick={() => setHistoryCursor(historyNextCursor ?? undefined)}
              type="button"
              variant="outline"
            >
              Load more
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
