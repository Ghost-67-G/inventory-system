import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useCategoriesDropdown } from '@/hooks/useCategories';
import { useBulkUpdateProducts } from '@/hooks/useProducts';

interface BulkCategoryModalProps {
  productIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function BulkCategoryModal({
  productIds,
  open,
  onOpenChange,
  onSuccess
}: BulkCategoryModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const { data: categories } = useCategoriesDropdown();
  const bulkUpdateMutation = useBulkUpdateProducts();

  // Reset the picked category whenever the modal closes (Cancel / X / overlay),
  // otherwise the previous choice leaks into the next open.
  useEffect(() => {
    if (!open) setSelectedCategoryId(null);
  }, [open]);

  const handleApply = async () => {
    try {
      await bulkUpdateMutation.mutateAsync({
        productIds,
        updates: {
          categoryId: selectedCategoryId
        }
      });
      onOpenChange(false);
      setSelectedCategoryId(null);
      onSuccess?.();
    } catch (error) {
      // Error is handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Category for {productIds.length} Products</DialogTitle>
          <DialogDescription>
            Select a new category or remove the category assignment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <select
            aria-label="Category"
            value={selectedCategoryId ?? ''}
            onChange={(e) => setSelectedCategoryId(e.target.value || null)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">No category</option>
            {categories?.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={bulkUpdateMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleApply()}
            disabled={bulkUpdateMutation.isPending || productIds.length === 0}
          >
            {bulkUpdateMutation.isPending ? '...' : `Apply to ${productIds.length} Products`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
