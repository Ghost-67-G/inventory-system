import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Escape / Cancel close the dialog; closing is blocked while deleting.
        if (!next) {
          if (isPending) return;
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">Delete '{fieldName}'?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>This field will be removed from the product form.</p>
              <p>Existing product data stored in this field will be preserved but no longer visible.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Radix closes the dialog on Action click by default; keep it open
              // until the parent finishes the request so the pending state is
              // visible and a failed delete does not silently dismiss the dialog.
              event.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
          >
            {isPending ? 'Deleting...' : 'Delete field'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
