import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { WarehouseChartData } from '@/types';

interface Props {
  data: WarehouseChartData[];
  isLoading?: boolean;
}

export function WarehouseBarChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-11/12" />
        <Skeleton className="h-10 w-10/12" />
      </div>
    );
  }

  const hasValues = data.length > 0 && data.some((item) => item.totalUnits > 0);
  if (!hasValues) {
    return <div className="flex h-[120px] items-center justify-center text-sm text-slate-500">No stock distributed across warehouses</div>;
  }

  const chartData = data.map((item) => ({ ...item, label: `${item.code} - ${item.name}` }));
  const chartHeight = Math.max(120, chartData.length * 52);

  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="horizontal" margin={{ left: 4, right: 30, top: 8, bottom: 0 }}>
          <YAxis type="category" dataKey="code" width={60} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <XAxis type="number" hide />
          <Bar dataKey="totalUnits" fill="#1D9E75" isAnimationActive={false}>
            <LabelList position="right" formatter={(value: number) => Number(value).toLocaleString()} className="fill-slate-700 text-xs" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
