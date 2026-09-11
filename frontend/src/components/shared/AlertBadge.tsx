interface AlertBadgeProps {
  status: 'PENDING' | 'ACKNOWLEDGED';
}

export function AlertBadge({ status }: AlertBadgeProps) {
  const styles =
    status === 'PENDING'
      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
      : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';

  return <span className={`whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium ${styles}`}>{status}</span>;
}
