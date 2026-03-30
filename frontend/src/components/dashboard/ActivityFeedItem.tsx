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
  green: { background: '#dcfce7', icon: '#15803d', amount: 'text-emerald-700' },
  red: { background: '#fee2e2', icon: '#dc2626', amount: 'text-red-700' },
  blue: { background: '#dbeafe', icon: '#2563eb', amount: 'text-blue-700' },
  amber: { background: '#fef3c7', icon: '#d97706', amount: 'text-amber-700' },
  teal: { background: '#d1fae5', icon: '#1D9E75', amount: 'text-emerald-700' },
  purple: { background: '#ede9fe', icon: '#534AB7', amount: 'text-violet-700' }
};

export function ActivityFeedItem({ movement }: { movement: IStockMovement }) {
  const meta = MOVEMENT_META[movement.type];
  const Icon = meta.icon;
  const color = colorStyles[meta.color];

  const quantityText =
    meta.sign === ''
      ? `${movement.quantity}`
      : `${meta.sign}${Math.abs(movement.quantity)}`;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 rounded-full p-2" style={{ backgroundColor: color.background }}>
        <Icon size={14} style={{ color: color.icon }} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{movement.product?.name ?? 'Unknown product'}</p>
        <p className="text-xs text-slate-500">
          {movement.quantity} {movement.product?.unit ?? ''} - {movement.warehouse?.name ?? 'Unknown warehouse'}
        </p>
      </div>

      <div className="text-right">
        <p className={`text-sm font-semibold ${color.amount}`}>{quantityText}</p>
        <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(movement.createdAt), { addSuffix: true })}</p>
      </div>
    </div>
  );
}
