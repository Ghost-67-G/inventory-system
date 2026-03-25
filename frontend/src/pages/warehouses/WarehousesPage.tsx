import { useQuery } from '@tanstack/react-query';
import { fetchWarehouses } from '@/api/endpoints/warehouses';
import { PageHeader } from '@/components/shared/PageHeader';

export function WarehousesPage() {
  const { data } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await fetchWarehouses();
      return (response.data as { success: boolean; data: Array<{ _id: string; name: string; location: string }> }).data;
    }
  });

  return (
    <div>
      <PageHeader title="Warehouses" subtitle="Manage storage locations" />
      <div className="space-y-2">
        {(data ?? []).map((warehouse) => (
          <div key={warehouse._id} className="rounded border bg-white p-3">
            <p className="font-medium">{warehouse.name}</p>
            <p className="text-sm text-slate-500">{warehouse.location}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
