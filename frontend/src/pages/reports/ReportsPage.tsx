import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { useWindowSize } from '@/hooks/useWindowSize';
import { StockValuationReport } from './StockValuationReport';
import { MovementHistoryReport } from './MovementHistoryReport';
import { LowStockReport } from './LowStockReport';
import { WasteAdjustmentsReport } from './WasteAdjustmentsReport';

/**
 * Main Reports page with tab navigation
 * URL search params preserve tab and filter state
 */
export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile } = useWindowSize();
  const tabFromUrl = searchParams.get('tab') || 'stock-valuation';
  const validTabs = ['stock-valuation', 'movement-history', 'low-stock', 'waste-adjustments'];
  const activeTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'stock-valuation';

  const handleTabChange = (tab: string) => {
    if (!validTabs.includes(tab)) return;
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Analyse and export your inventory data"
      />

      {isMobile ? (
        <select
          value={activeTab}
          onChange={(event) => handleTabChange(event.target.value)}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="stock-valuation">Stock Valuation</option>
          <option value="movement-history">Movement History</option>
          <option value="low-stock">Low Stock</option>
          <option value="waste-adjustments">Waste & Adjustments</option>
        </select>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full grid-cols-4 ${isMobile ? 'hidden' : ''}`}>
          <TabsTrigger value="stock-valuation">Stock Valuation</TabsTrigger>
          <TabsTrigger value="movement-history">Movement History</TabsTrigger>
          <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
          <TabsTrigger value="waste-adjustments">Waste & Adjustments</TabsTrigger>
        </TabsList>

        <TabsContent value="stock-valuation" className="mt-6">
          <StockValuationReport />
        </TabsContent>

        <TabsContent value="movement-history" className="mt-6">
          <MovementHistoryReport />
        </TabsContent>

        <TabsContent value="low-stock" className="mt-6">
          <LowStockReport />
        </TabsContent>

        <TabsContent value="waste-adjustments" className="mt-6">
          <WasteAdjustmentsReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
