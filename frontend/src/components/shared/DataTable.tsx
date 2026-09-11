import { useEffect, useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
  type SortingState,
  type RowSelectionState
} from '@tanstack/react-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onFetchNextPage?: () => void;
  rowHeight?: number;
  estimatedRowHeight?: number;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  enableRowSelection?: boolean;
  onSelectionChange?: (selectedRows: TData[]) => void;
  emptyMessage?: string;
  loadingRows?: number;
  hiddenColumnIds?: string[];
  maxHeight?: string;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  onFetchNextPage,
  rowHeight = 52,
  estimatedRowHeight,
  onRowClick,
  getRowId,
  enableRowSelection = false,
  onSelectionChange,
  emptyMessage = 'No data found',
  loadingRows = 10,
  hiddenColumnIds = [],
  maxHeight = 'calc(100dvh - 320px)'
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const parentRef = useRef<HTMLDivElement>(null);

  const selectionColumn: ColumnDef<TData> = {
    id: '__select__',
    size: 40,
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className="cursor-pointer"
        aria-label="Select all rows"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        className="cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Select row"
      />
    )
  };

  // Guard against malformed API rows; TanStack accessors assume each row exists.
  const safeData = useMemo(() => data.filter((row) => row != null) as TData[], [data]);

  const tableColumns = enableRowSelection ? [selectionColumn, ...columns] : columns;

  const table = useReactTable({
    data: safeData,
    columns: tableColumns,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  // Depend on the serialized value, not the array reference. Callers that omit
  // this prop get a fresh `[]` default on every render (including this table's
  // own re-renders), which previously re-ran the effect and set a new object
  // each time -> infinite render loop that starved route navigation. A stable
  // string key plus a no-op bail-out keeps it running only when the value changes.
  const hiddenColumnsKey = hiddenColumnIds.join('|');
  useEffect(() => {
    const nextState: VisibilityState = {};
    hiddenColumnIds.forEach((id) => {
      nextState[id] = false;
    });
    setColumnVisibility((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(nextState);
      const unchanged =
        prevKeys.length === nextKeys.length && nextKeys.every((id) => prev[id] === false);
      return unchanged ? prev : nextState;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenColumnsKey]);

  // Keep selection in sync with the data: drop ids for rows that were removed
  // (deleted, filtered out, re-fetched) and tell the parent about the current
  // selection. The callback lives in a ref so an inline arrow from the parent
  // does not re-run this effect on every render.
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const lastEmittedSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enableRowSelection) {
      return;
    }

    const rowKey = (row: TData, index: number) => (getRowId ? getRowId(row) : String(index));
    const validKeys = new Set(safeData.map(rowKey));

    const selectedKeys = Object.keys(rowSelection).filter((key) => rowSelection[key]);
    const prunedKeys = selectedKeys.filter((key) => validKeys.has(key));

    if (prunedKeys.length !== selectedKeys.length) {
      const next: RowSelectionState = {};
      prunedKeys.forEach((key) => {
        next[key] = true;
      });
      setRowSelection(next);
      return; // effect re-runs with the pruned state
    }

    const serialized = prunedKeys.join('|');
    if (serialized === lastEmittedSelectionRef.current) {
      return;
    }
    lastEmittedSelectionRef.current = serialized;

    const selectedRows = safeData.filter((row, index) => rowSelection[rowKey(row, index)]);
    onSelectionChangeRef.current?.(selectedRows);
  }, [rowSelection, safeData, enableRowSelection, getRowId]);

  const rows = table.getRowModel().rows;

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const handleScroll = () => {
      const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
      if (remaining < 160 && hasNextPage && !isFetchingNextPage) {
        onFetchNextPage?.();
      }
    };

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, onFetchNextPage]);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <table
          className="w-full table-fixed border-collapse text-sm text-foreground"
          style={{ minWidth: table.getTotalSize() }}
        >
          <thead className="border-b border-border bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    onKeyDown={
                      header.column.getCanSort()
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              header.column.toggleSorting();
                            }
                          }
                        : undefined
                    }
                    tabIndex={header.column.getCanSort() ? 0 : undefined}
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : undefined
                    }
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer select-none' : ''}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-muted-foreground/70">
                            {header.column.getIsSorted() === 'asc' ? '↑' : header.column.getIsSorted() === 'desc' ? '↓' : '↕'}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: loadingRows }).map((_, idx) => (
                <tr key={idx} className="border-b border-border">
                  {tableColumns.map((column, colIdx) => (
                    <td
                      key={colIdx}
                      className="px-4 py-3"
                      style={{ width: table.getAllLeafColumns()[colIdx]?.getSize?.() ?? (column as any)?.size }}
                    >
                      <Skeleton className="h-5 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={tableColumns.length} className="h-32 px-4 py-3 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                    className={`border-b border-border transition-colors hover:bg-muted/50 ${
                    row.getIsSelected() ? 'bg-muted/60' : ''
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
                  style={{ height: estimatedRowHeight ?? rowHeight }}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 align-middle break-words"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}

            {isFetchingNextPage && (
              <tr>
                <td colSpan={tableColumns.length} className="px-4 py-4">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

