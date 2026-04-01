import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import type { IWarehouse } from '@/types';
import { useDeactivateWarehouse } from '@/hooks/useWarehouses';

interface ConfirmDeactivateWarehouseDialogProps {
  warehouse: IWarehouse;
  open: boolean;
  onClose: () => void;
}

export function ConfirmDeactivateWarehouseDialog({
  warehouse,
  open,
  onClose
}: ConfirmDeactivateWarehouseDialogProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const deactivateMutation = useDeactivateWarehouse();
  const isLoading = deactivateMutation.isPending;
  const hasStock = warehouse.stockSummary.totalUnits > 0;

  async function handleDeactivate() {
    try {
      setApiError(null);
      await deactivateMutation.mutateAsync(warehouse._id);
      onClose();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        setApiError(message ?? 'Failed to deactivate warehouse');
        return;
      }
      setApiError('Failed to deactivate warehouse');
    }
  }

  if (hasStock) {
    // State B: Cannot deactivate — has stock
    return (
      <AlertDialog open={open} onOpenChange={onClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Cannot deactivate "{warehouse.name}"
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="space-y-2">
            <p>
              This warehouse contains <strong>{warehouse.stockSummary.totalUnits} units</strong> across{' '}
              <strong>{warehouse.stockSummary.totalProducts} products</strong>.
            </p>
            <p>Transfer all stock to another warehouse before deactivating.</p>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Got it</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // State A: Safe to deactivate — no stock
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate "{warehouse.name}"?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription className="space-y-3">
          <p>
            This warehouse will be deactivated and hidden from stock forms. You can reactivate it at any
            time.
          </p>
          {warehouse.isDefault && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
              <p className="text-sm text-amber-900 dark:text-amber-400">
                <strong>Warning: This is your default warehouse.</strong> Another active warehouse will be
                automatically set as the new default.
              </p>
            </div>
          )}
          {apiError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              {apiError}
            </div>
          )}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeactivate}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Deactivating...' : 'Deactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
