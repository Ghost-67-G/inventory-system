import { formatDistanceToNow } from 'date-fns';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  SlidersHorizontal,
  Trash2,
  type LucideIcon
} from 'lucide-react';
import type { IStockMovement, MovementType } from '@/types';

interface MovementMeta {
  icon: LucideIcon;
  color: 'green' | 'red' | 'blue' | 'amber' | 'teal' | 'purple';
  label: string;
  sign: '' | '+' | '-';
}

export const MOVEMENT_META: Record<MovementType, MovementMeta> = {
  IN: { icon: ArrowDownToLine, color: 'green', label: 'Stock in', sign: '+' },
  OUT: { icon: ArrowUpFromLine, color: 'red', label: 'Stock out', sign: '-' },
  ADJUSTMENT: { icon: SlidersHorizontal, color: 'blue', label: 'Adjustment', sign: '' },
  WASTE: { icon: Trash2, color: 'amber', label: 'Waste', sign: '-' },
  TRANSFER_IN: { icon: ArrowRight, color: 'teal', label: 'Transfer in', sign: '+' },
  TRANSFER_OUT: { icon: ArrowLeft, color: 'purple', label: 'Transfer out', sign: '-' }
};

const colorStyles: Record<MovementMeta['color'], { background: string; icon: string; amount: string }> = {
  green: { background: 'bg-green-100 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-400', amount: 'text-green-600 dark:text-green-400' },
  red: { background: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-400', amount: 'text-red-600 dark:text-red-400' },
  blue: { background: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400', amount: 'text-blue-600 dark:text-blue-400' },
  amber: { background: 'bg-amber-100 dark:bg-amber-900/30', icon: 'text-amber-600 dark:text-amber-400', amount: 'text-amber-600 dark:text-amber-400' },
  teal: { background: 'bg-teal-100 dark:bg-teal-900/30', icon: 'text-teal-600 dark:text-teal-400', amount: 'text-teal-600 dark:text-teal-400' },
  purple: { background: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-400', amount: 'text-purple-600 dark:text-purple-400' }
};

export function ActivityFeedItem({ movement }: { movement: IStockMovement }) {
  // Fall back to a neutral style for unknown/new movement types instead of crashing.
  const meta = MOVEMENT_META[movement.type] ?? MOVEMENT_META.ADJUSTMENT;
  const Icon = meta.icon;
  const color = colorStyles[meta.color];

  const quantity = Number(movement.quantity ?? 0);
  const quantityText =
    meta.sign === ''
      ? `${quantity}`
      : `${meta.sign}${Math.abs(quantity)}`;

  const createdAt = new Date(movement.createdAt);
  const timeAgo = Number.isNaN(createdAt.getTime()) ? '-' : formatDistanceToNow(createdAt, { addSuffix: true });

  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`mt-0.5 shrink-0 rounded-full p-2 ${color.background}`}>
        <Icon size={14} className={color.icon} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{movement.product?.name ?? 'Unknown product'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {meta.label} - {quantity} {movement.product?.unit ?? ''} - {movement.warehouse?.name ?? 'Unknown warehouse'}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold ${color.amount}`}>{quantityText}</p>
        <p className="whitespace-nowrap text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  );
}
