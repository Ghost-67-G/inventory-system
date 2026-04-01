import { cn } from '@/lib/utils';

interface StockBadgeProps {
  stock: number;
  threshold: number;
  unit: string;
  showUnit?: boolean;
}

export default function StockBadge({ stock, threshold, unit, showUnit = true }: StockBadgeProps) {
  let valueClass = 'text-green-600 dark:text-green-400';
  let badgeClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  let badge: string | null = null;

  if (stock > threshold) {
    valueClass = 'text-green-600 dark:text-green-400';
    badgeClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  } else if (stock > 0 && stock <= threshold) {
    valueClass = 'text-amber-600 dark:text-amber-400';
    badgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    badge = 'Low stock';
  } else if (stock === 0) {
    valueClass = 'text-red-600 dark:text-red-400';
    badgeClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    badge = 'Out of stock';
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-sm font-medium', valueClass)}>
        {stock} {showUnit ? unit : ''}
      </span>
      {badge ? (
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', badgeClass)}>
          {badge}
        </span>
      ) : null}
    </div>
  );
}
