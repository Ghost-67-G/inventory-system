declare module '@tanstack/react-query' {
  export class QueryClient {}
  export const QueryClientProvider: (props: { client: QueryClient; children?: import('react').ReactNode }) => import('react').ReactNode;
  export function useQuery<TData>(options: { queryKey: unknown[]; queryFn: () => Promise<TData> }): { data: TData | undefined };
}

declare module '@tanstack/react-table' {
  export type SortingState = unknown[];
  export interface ColumnDef<TData, TValue = unknown> {
    header?: unknown;
    cell?: unknown;
    accessorKey?: keyof TData;
  }
  export function createColumnHelper<TData>(): {
    accessor<TKey extends keyof TData>(
      key: TKey,
      opts: { header: string; cell: (info: { getValue(): TData[TKey] }) => string | number }
    ): ColumnDef<TData, TData[TKey]>;
  };
  export function getCoreRowModel(): () => unknown;
  export function getSortedRowModel(): () => unknown;
  export function flexRender(renderer: unknown, context: unknown): import('react').ReactNode;
  export function useReactTable<TData>(options: {
    data: TData[];
    columns: Array<ColumnDef<TData>>;
    state?: { sorting?: SortingState };
    onSortingChange?: (updater: SortingState) => void;
    getCoreRowModel?: () => unknown;
    getSortedRowModel?: () => unknown;
  }): {
    getHeaderGroups(): Array<{ id: string; headers: Array<{ id: string; isPlaceholder: boolean; column: { columnDef: { header?: unknown } }; getContext(): unknown }> }>;
    getRowModel(): { rows: Array<{ id: string; getVisibleCells(): Array<{ id: string; column: { columnDef: { cell?: unknown } }; getContext(): unknown }> }> };
  };
}

declare module '@tanstack/react-virtual' {
  export function useVirtualizer(options: {
    count: number;
    getScrollElement: () => Element | null;
    estimateSize: () => number;
    overscan?: number;
  }): {
    getTotalSize(): number;
    getVirtualItems(): Array<{ index: number; start: number }>;
  };
}
