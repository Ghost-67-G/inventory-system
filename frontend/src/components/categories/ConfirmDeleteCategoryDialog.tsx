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
import { useDeleteCategory } from '@/hooks/useCategories';
import type { ICategory } from '@/types';

interface ConfirmDeleteCategoryDialogProps {
  category: ICategory;
  open: boolean;
  onClose: () => void;
}

export function ConfirmDeleteCategoryDialog({
  category,
  open,
  onClose
}: ConfirmDeleteCategoryDialogProps) {
  const deleteMutation = useDeleteCategory();

  // State B — has products: informational only
  const hasProducts = category.productCount > 0;

  // State A — safe to delete
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(category._id);
      onClose();
    } catch {
      // error toast is handled by the mutation hook; keep the dialog open
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Escape / Cancel / "Got it" close the dialog; closing is blocked while deleting.
        if (!next) {
          if (deleteMutation.isPending) return;
          onClose();
        }
      }}
    >
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasProducts ? (
              <>Cannot delete &ldquo;{category.name}&rdquo;</>
            ) : (
              <>Delete &ldquo;{category.name}&rdquo;?</>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasProducts ? (
              <>
                {category.productCount} product{category.productCount > 1 ? 's are' : ' is'} assigned to
                it. Reassign or deactivate those products first.
              </>
            ) : (
              <>This category will be permanently deleted. This cannot be undone.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:space-x-0">
          {hasProducts ? (
            // Plain close with primary styling; Radix closes the dialog on Action click.
            <AlertDialogAction>Got it</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
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
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
