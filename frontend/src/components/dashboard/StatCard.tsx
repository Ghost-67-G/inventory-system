import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accentColor: 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'purple';
  helperText?: string;
  isLoading?: boolean;
  onClick?: () => void;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

const ACCENT_MAP: Record<StatCardProps['accentColor'], string> = {
  blue: 'var(--color-text-info, #1d4ed8)',
  green: 'var(--color-text-success, #15803d)',
  amber: 'var(--color-text-warning, #d97706)',
  red: 'var(--color-text-danger, #dc2626)',
  teal: '#1D9E75',
  purple: '#534AB7'
};

export function StatCard({ label, value, icon: Icon, accentColor, helperText, isLoading, onClick, trend }: StatCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <Skeleton className="mb-3 h-4 w-2/3" />
        <Skeleton className="mb-2 h-8 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    );
  }

  const accent = ACCENT_MAP[accentColor];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors ${
        onClick ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <Icon size={20} style={{ color: accent }} />
      </div>
      <p className="text-[28px] font-medium text-foreground">{value}</p>
      {helperText ? <p className="mt-1 text-[11px] text-muted-foreground">{helperText}</p> : null}
      {trend ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {trend.direction === 'up' ? 'Up' : 'Down'} {trend.value}%
        </p>
      ) : null}
    </button>
  );
}
