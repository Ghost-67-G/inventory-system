import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog';
import { useDeleteProduct } from '@/hooks/useProducts';
import type { IProduct } from '@/types';

interface ConfirmDeleteProductDialogProps {
  product: IProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ConfirmDeleteProductDialog({
  product,
  open,
  onOpenChange,
  onSuccess
}: ConfirmDeleteProductDialogProps) {
  const deleteMutation = useDeleteProduct();

  if (!product) return null;

  const canDelete = product.totalStock === 0;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(product._id);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error is handled by mutation
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {canDelete ? `Delete '${product.name}'?` : `Cannot Delete '${product.name}'`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {canDelete ? (
              <>
                SKU: <span className="font-mono text-foreground">{product.sku}</span>
                <br />
                This product will be permanently deleted.
              </>
            ) : (
              <>
                This product has <strong>{product.totalStock}</strong> {product.unit} in stock.
                <br />
                Adjust stock to zero or deactivate the product instead.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-wrap justify-end gap-3">
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            {canDelete ? 'Cancel' : 'Got it'}
          </AlertDialogCancel>
          {canDelete && (
            <AlertDialogAction
              onClick={(event) => {
                // Radix closes the dialog on Action click by default; keep it open
                // until the request resolves so the pending state is visible and
                // a failed delete does not silently dismiss the dialog.
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {deleteMutation.isPending ? '...' : 'Delete'}
            </AlertDialogAction>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
