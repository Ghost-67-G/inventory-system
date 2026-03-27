import { Button } from '@/components/ui/button';
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

  if (!open) return null;

  // State B — has products: informational only
  if (category.productCount > 0) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-900">
            Cannot delete &ldquo;{category.name}&rdquo;
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {category.productCount} product{category.productCount > 1 ? 's are' : ' is'} assigned to
            it. Reassign or deactivate those products first.
          </p>
          <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>Got it</Button>
          </div>
        </div>
      </div>
    );
  }

  // State A — safe to delete
  const handleDelete = async () => {
    await deleteMutation.mutateAsync(category._id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          Delete &ldquo;{category.name}&rdquo;?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This category will be permanently deleted. This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}
