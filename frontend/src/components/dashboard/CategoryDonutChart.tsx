import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { CategoryChartData } from '@/types';

interface Props {
  data: CategoryChartData[];
  currency: string;
  isLoading?: boolean;
}

function formatCurrencyValue(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(value);
}

export function CategoryDonutChart({ data, currency, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-[260px] w-full rounded-full" />;
  }

  if (data.length === 0) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">No stock value to display</div>;
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const item = payload[0].payload as CategoryChartData;
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';

    return (
      <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow">
        <p className="text-slate-700">{item.name}</p>
        <p className="text-slate-900">
          {formatCurrencyValue(item.value, currency)} ({pct}%)
        </p>
      </div>
    );
  };

  return (
    <div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={70}
              outerRadius={110}
              isAnimationActive={false}
              stroke="none"
              paddingAngle={1}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={renderTooltip} />
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 text-sm font-semibold">
              {formatCurrencyValue(total, currency)}
            </text>
            <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-xs">
              total value
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
        {data.map((item) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
          return (
            <div key={item.name} className="flex items-center gap-2 text-xs text-slate-700">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
              <span className="text-slate-500">{formatCurrencyValue(item.value, currency)}</span>
              <span className="text-slate-400">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
