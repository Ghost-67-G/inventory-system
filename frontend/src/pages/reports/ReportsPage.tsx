import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { StockValuationReport } from './StockValuationReport';
import { MovementHistoryReport } from './MovementHistoryReport';
import { LowStockReport } from './LowStockReport';
import { WasteAdjustmentsReport } from './WasteAdjustmentsReport';

const REPORT_TABS = [
  { value: 'stock-valuation', label: 'Stock Valuation' },
  { value: 'movement-history', label: 'Movement History' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'waste-adjustments', label: 'Waste & Adjustments' }
];

/**
 * Main Reports page with tab navigation
 * URL search params preserve tab and filter state
 */
export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'stock-valuation';
  const validTabs = REPORT_TABS.map((tab) => tab.value);
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Mobile (<640px): native select. CSS breakpoints instead of a JS
            window-size check so there is no flash / mismatched state on resize. */}
        <div className="sm:hidden">
          <label htmlFor="reports-tab-select" className="sr-only">
            Select report
          </label>
          <select
            id="reports-tab-select"
            value={activeTab}
            onChange={(event) => handleTabChange(event.target.value)}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {REPORT_TABS.map((tab) => (
              <option key={tab.value} value={tab.value}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tablet/desktop: underline tabs. Natural widths (no grid-cols-4) so the
            labels never get clipped; TabsList scrolls horizontally if needed. */}
        <div className="hidden sm:block">
          <TabsList className="w-full">
            {REPORT_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

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
