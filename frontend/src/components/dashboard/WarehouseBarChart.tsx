import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useThemeStore } from '@/store/themeStore';
import type { WarehouseChartData } from '@/types';

interface Props {
  data: WarehouseChartData[];
  isLoading?: boolean;
}

function WarehouseTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const item = payload[0].payload as WarehouseChartData;
  return (
    <div className="rounded-md border border-border bg-popover p-2 text-xs shadow">
      <p className="text-foreground">{item.code} - {item.name}</p>
      <p className="text-muted-foreground">{Number(item.totalUnits).toLocaleString()} units</p>
    </div>
  );
}

export function WarehouseBarChart({ data, isLoading }: Props) {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-11/12" />
        <Skeleton className="h-10 w-10/12" />
      </div>
    );
  }

  const safeData = data.filter((item) => Number.isFinite(item.totalUnits) && item.totalUnits >= 0);
  const hasValues = safeData.length > 0 && safeData.some((item) => item.totalUnits > 0);
  if (!hasValues) {
    return <div className="flex h-30 items-center justify-center text-sm text-muted-foreground">No stock distributed across warehouses</div>;
  }

  const chartData = safeData.map((item) => ({ ...item, label: `${item.code} - ${item.name}` }));
  const chartHeight = Math.max(120, chartData.length * 52);
  const barColor = isDark ? '#5DCAA5' : '#1D9E75';
  const tickColor = 'var(--muted-foreground)';
  const labelColor = 'var(--foreground)';

  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        {/* layout="vertical" = horizontal bars (category on Y, number on X) */}
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 56, top: 8, bottom: 0 }}>
          <YAxis type="category" dataKey="code" width={60} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} />
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <Tooltip content={<WarehouseTooltip />} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey="totalUnits" fill={barColor} isAnimationActive={false} radius={[0, 2, 2, 0]}>
            <LabelList
              dataKey="totalUnits"
              position="right"
              formatter={(value: number) => Number(value).toLocaleString()}
              fill={labelColor}
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
