interface AlertBadgeProps {
  status: 'PENDING' | 'ACKNOWLEDGED';
}

export function AlertBadge({ status }: AlertBadgeProps) {
  const styles =
    status === 'PENDING' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300';

  return <span className={`rounded-full border px-2 py-1 text-xs font-medium ${styles}`}>{status}</span>;
}
