import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useWindowSize } from '@/hooks/useWindowSize';
import type { CategoryChartData } from '@/types';

interface Props {
  data: CategoryChartData[];
  currency: string;
  isLoading?: boolean;
}

const FALLBACK_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

function formatCurrencyValue(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(value);
}

export function CategoryDonutChart({ data, currency, isLoading }: Props) {
  const { isMobile } = useWindowSize();
  const chartHeight = isMobile ? 200 : 260;

  if (isLoading) {
    return <Skeleton className="h-50 w-full rounded-full md:h-65" />;
  }

  // Drop rows that would render as NaN slices / NaN percentages.
  const safeData = data.filter((item) => Number.isFinite(item.value) && item.value > 0);
  const total = safeData.reduce((sum, item) => sum + item.value, 0);

  if (safeData.length === 0 || total <= 0) {
    return <div className="flex h-50 items-center justify-center text-sm text-muted-foreground md:h-65">No stock value to display</div>;
  }

  const colorFor = (item: CategoryChartData, index: number) => item.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const item = payload[0].payload as CategoryChartData;
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';

    return (
      <div className="rounded-md border border-border bg-popover p-2 text-xs shadow">
        <p className="text-foreground">{item.name}</p>
        <p className="text-foreground">
          {formatCurrencyValue(item.value, currency)} ({pct}%)
        </p>
      </div>
    );
  };

  return (
    <div>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safeData}
              dataKey="value"
              innerRadius="62%"
              outerRadius="92%"
              isAnimationActive={false}
              stroke="none"
              paddingAngle={1}
            >
              {safeData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={colorFor(entry, index)} />
              ))}
            </Pie>
            <Tooltip content={renderTooltip} />
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-sm font-semibold">
              {formatCurrencyValue(total, currency)}
            </text>
            <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
              total value
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
        {safeData.map((item, index) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={`${item.name}-${index}`} className="flex min-w-0 max-w-full items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorFor(item, index) }} />
              <span className="truncate" title={item.name}>{item.name}</span>
              <span className="shrink-0">{formatCurrencyValue(item.value, currency)}</span>
              <span className="shrink-0 text-muted-foreground/70">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
