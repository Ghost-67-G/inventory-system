import { format, isValid, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useThemeStore } from '@/store/themeStore';
import type { MovementChartData } from '@/types';

interface Props {
  data: MovementChartData[];
  isLoading?: boolean;
}

// Dates arrive as "yyyy-MM-dd". `new Date('yyyy-MM-dd')` parses as UTC midnight,
// which renders as the previous day in negative-offset timezones; parseISO is local.
function formatChartDate(value: unknown, pattern: string): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  const date = parseISO(value);
  return isValid(date) ? format(date, pattern) : value;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0 || typeof label !== 'string') {
    return null;
  }

  const inValue = Number(payload.find((item) => item.dataKey === 'in')?.value ?? 0);
  const outValue = Number(payload.find((item) => item.dataKey === 'out')?.value ?? 0);

  return (
    <div className="rounded-md border border-border bg-popover p-2 text-xs shadow">
      <p className="mb-1 text-foreground">{formatChartDate(label, 'MMM d, yyyy')}</p>
      <p className="text-emerald-700 dark:text-emerald-400">In: +{inValue} units</p>
      <p className="text-red-700 dark:text-red-400">Out: -{outValue} units</p>
    </div>
  );
}

export function MovementBarChart({ data, isLoading }: Props) {
  const { isMobile } = useWindowSize();
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  const chartHeight = isMobile ? 200 : 260;
  const inColor = isDark ? '#5DCAA5' : '#1D9E75';
  const outColor = isDark ? '#F0997B' : '#D85A30';
  const gridColor = 'var(--border)';
  const textColor = 'var(--muted-foreground)';

  if (isLoading) {
    return <Skeleton className="h-50 w-full md:h-65" />;
  }

  const hasValues = data.some((item) => item.in > 0 || item.out > 0);
  if (!hasValues) {
    return <div className="flex h-50 items-center justify-center text-sm text-muted-foreground md:h-65">No movements in last 30 days</div>;
  }

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
          <XAxis
            dataKey="date"
            interval={isMobile ? 6 : 4}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: textColor }}
            tickFormatter={(dateStr: string) => formatChartDate(dateStr, 'MMM d')}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={isMobile ? 36 : 48}
            tick={{ fontSize: 11, fill: textColor }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)' }} />
          <Legend formatter={(value) => (value === 'in' ? 'Stock in' : 'Stock out')} wrapperStyle={{ color: textColor, fontSize: 12 }} />
          <Bar dataKey="in" fill={inColor} isAnimationActive={false} radius={[2, 2, 0, 0]} />
          <Bar dataKey="out" fill={outColor} isAnimationActive={false} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
