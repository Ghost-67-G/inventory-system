import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportSummaryCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  accentColor?: 'red' | 'green' | 'amber' | 'blue' | 'purple';
  icon?: LucideIcon;
}

const accentStyles = {
  red: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-100',
  green: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-100',
  amber: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-100',
  blue: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-100',
  purple: 'bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/30 dark:border-purple-900/50 dark:text-purple-100'
};

const iconStyles = {
  red: 'text-red-600 dark:text-red-400',
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  blue: 'text-blue-600 dark:text-blue-400',
  purple: 'text-purple-600 dark:text-purple-400'
};

/**
 * Report summary card — shows key metrics
 * Smaller than StatCard, used in filter bars
 */
export function ReportSummaryCard({
  label,
  value,
  subLabel,
  accentColor = 'blue',
  icon: Icon
}: ReportSummaryCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border-2 p-3 flex items-center gap-3',
        accentStyles[accentColor]
      )}
    >
      {Icon && <Icon className={cn('h-5 w-5 shrink-0', iconStyles[accentColor])} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium opacity-75 truncate" title={label}>{label}</p>
        <p className="text-lg font-bold truncate" title={String(value)}>{value}</p>
        {subLabel && <p className="text-xs opacity-60 truncate" title={subLabel}>{subLabel}</p>}
      </div>
    </div>
  );
}
