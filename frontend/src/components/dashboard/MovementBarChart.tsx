import { format } from 'date-fns';
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
import type { MovementChartData } from '@/types';

interface Props {
  data: MovementChartData[];
  isLoading?: boolean;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0 || typeof label !== 'string') {
    return null;
  }

  const inValue = Number(payload.find((item) => item.dataKey === 'in')?.value ?? 0);
  const outValue = Number(payload.find((item) => item.dataKey === 'out')?.value ?? 0);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow">
      <p className="mb-1 text-slate-700">{format(new Date(label), 'MMM d, yyyy')}</p>
      <p className="text-emerald-700">In: +{inValue} units</p>
      <p className="text-red-700">Out: -{outValue} units</p>
    </div>
  );
}

export function MovementBarChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <Skeleton className="h-[260px] w-full" />;
  }

  const hasValues = data.some((item) => item.in > 0 || item.out > 0);
  if (!hasValues) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">No movements in last 30 days</div>;
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            interval={4}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(dateStr: string) => format(new Date(dateStr), 'MMM d')}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(value) => (value === 'in' ? 'Stock in' : 'Stock out')} />
          <Bar dataKey="in" fill="#1D9E75" isAnimationActive={false} radius={[2, 2, 0, 0]} />
          <Bar dataKey="out" fill="#D85A30" isAnimationActive={false} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
