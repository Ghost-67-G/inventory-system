import type { POStatus } from '@/types';

const STATUS_STYLE: Record<POStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PARTIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  RECEIVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
};

const STATUS_LABEL: Record<POStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIAL: 'Partial',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled'
};

interface POStatusBadgeProps {
  status: POStatus;
  size?: 'sm' | 'md';
}

export function POStatusBadge({ status, size = 'md' }: POStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-medium ${STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground'} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
