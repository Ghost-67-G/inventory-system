import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useThemeStore } from '@/store/themeStore';

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

// Light/dark pairs: the *-700 shades used previously are too dark to read on a dark card.
const ACCENT_MAP: Record<StatCardProps['accentColor'], { light: string; dark: string }> = {
  blue: { light: '#1d4ed8', dark: '#60a5fa' },
  green: { light: '#15803d', dark: '#4ade80' },
  amber: { light: '#d97706', dark: '#fbbf24' },
  red: { light: '#dc2626', dark: '#f87171' },
  teal: { light: '#1D9E75', dark: '#5DCAA5' },
  purple: { light: '#534AB7', dark: '#A5A0E8' }
};

export function StatCard({ label, value, icon: Icon, accentColor, helperText, isLoading, onClick, trend }: StatCardProps) {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <Skeleton className="mb-3 h-4 w-2/3" />
        <Skeleton className="mb-2 h-8 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    );
  }

  const accent = isDark ? ACCENT_MAP[accentColor].dark : ACCENT_MAP[accentColor].light;

  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
      className={`min-w-0 w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors ${
        onClick ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-[13px] text-muted-foreground" title={label}>{label}</p>
        <Icon size={20} className="shrink-0" style={{ color: accent }} />
      </div>
      <p className="truncate text-[28px] font-medium leading-tight text-foreground" title={String(value)}>{value}</p>
      {helperText ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{helperText}</p> : null}
      {trend ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {trend.direction === 'up' ? 'Up' : 'Down'} {trend.value}%
        </p>
      ) : null}
    </button>
  );
}
