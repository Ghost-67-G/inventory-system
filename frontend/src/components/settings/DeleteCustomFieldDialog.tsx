import { Button } from '@/components/ui/button';

interface DeleteCustomFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: string;
  onConfirm: () => void;
  isPending?: boolean;
}

export function DeleteCustomFieldDialog({
  open,
  onOpenChange,
  fieldName,
  onConfirm,
  isPending = false,
}: DeleteCustomFieldDialogProps) {
  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-custom-field-title"
      className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 id="delete-custom-field-title" className="break-words text-lg font-semibold text-foreground">Delete '{fieldName}'?</h2>

        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <p>This field will be removed from the product form.</p>
          <p>Existing product data stored in this field will be preserved but no longer visible.</p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? 'Deleting...' : 'Delete field'}
          </Button>
        </div>
      </div>
    </div>
  );
}
