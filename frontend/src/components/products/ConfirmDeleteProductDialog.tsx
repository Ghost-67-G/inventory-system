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
        <div className="flex gap-3">
          <AlertDialogCancel>
            {canDelete ? 'Cancel' : 'Got it'}
          </AlertDialogCancel>
          {canDelete && (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? '...' : 'Delete'}
            </AlertDialogAction>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
