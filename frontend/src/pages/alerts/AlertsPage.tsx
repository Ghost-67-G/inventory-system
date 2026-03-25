import { useQuery } from '@tanstack/react-query';
import { fetchAlerts } from '@/api/endpoints/alerts';
import { AlertBadge } from '@/components/shared/AlertBadge';
import { PageHeader } from '@/components/shared/PageHeader';

export function AlertsPage() {
  const { data } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const response = await fetchAlerts();
      return (response.data as { success: boolean; data: Array<{ _id: string; status: 'PENDING' | 'ACKNOWLEDGED' }> }).data;
    }
  });

  return (
    <div>
      <PageHeader title="Stock Alerts" subtitle="Low stock warning queue" />
      <div className="space-y-2">
        {(data ?? []).map((alert) => (
          <div key={alert._id} className="rounded border bg-white p-3">
            <AlertBadge status={alert.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
