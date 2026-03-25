import { useQuery } from '@tanstack/react-query';
import { fetchStockMovements } from '../../api/endpoints/stock';
import { PageHeader } from '../../components/shared/PageHeader';

export function StockMovementsPage() {
  const { data } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const response = await fetchStockMovements();
      return (response.data as { success: boolean; data: Array<{ _id: string; type: string; quantity: number }> }).data;
    }
  });

  return (
    <div>
      <PageHeader title="Stock Movements" subtitle="Immutable stock ledger" />
      <div className="space-y-2">
        {(data ?? []).map((movement) => (
          <div key={movement._id} className="rounded border bg-white p-3">
            <span className="mr-2 rounded bg-slate-100 px-2 py-1 text-xs">{movement.type}</span>
            <span>{movement.quantity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
