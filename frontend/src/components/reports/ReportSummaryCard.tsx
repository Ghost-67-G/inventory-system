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
  red: 'bg-red-50 border-red-200 text-red-900',
  green: 'bg-green-50 border-green-200 text-green-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  purple: 'bg-purple-50 border-purple-200 text-purple-900'
};

const iconStyles = {
  red: 'text-red-600',
  green: 'text-green-600',
  amber: 'text-amber-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600'
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
      {Icon && <Icon className={cn('h-5 w-5 flex-shrink-0', iconStyles[accentColor])} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium opacity-75">{label}</p>
        <p className="text-lg font-bold truncate">{value}</p>
        {subLabel && <p className="text-xs opacity-60 truncate">{subLabel}</p>}
      </div>
    </div>
  );
}
