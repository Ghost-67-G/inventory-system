declare module '@tanstack/react-query' {
  export class QueryClient {
    invalidateQueries: (options: { queryKey: unknown[] }) => Promise<void>;
  }
  export const QueryClientProvider: (props: { client: QueryClient; children?: import('react').ReactNode }) => import('react').ReactNode;
  export function useQueryClient(): QueryClient;
  export function useQuery<TData, TSelect = TData>(options: {
    queryKey: unknown[];
    queryFn: () => Promise<TData>;
    enabled?: boolean;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
    select?: (data: TData) => TSelect;
    onError?: (error: unknown) => void;
  }): { data: TSelect | undefined; isLoading: boolean; error: unknown };
  export function useMutation<TData = unknown, TError = unknown, TVariables = void>(options: {
    mutationFn: (variables: TVariables) => Promise<TData>;
    onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
    onError?: (error: TError, variables: TVariables) => void | Promise<void>;
    onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void | Promise<void>;
  }): {
    mutate: (variables: TVariables) => void;
    mutateAsync: (variables: TVariables) => Promise<TData>;
    isPending: boolean;
    isError: boolean;
    error: TError | null;
    data: TData | undefined;
    reset: () => void;
  };
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
