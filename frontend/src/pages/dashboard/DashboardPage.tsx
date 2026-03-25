import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';

export function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live inventory summary" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Products" value="0" />
        <StatCard label="Low Stock Alerts" value="0" />
        <StatCard label="Warehouses" value="0" />
      </div>
    </div>
  );
}
