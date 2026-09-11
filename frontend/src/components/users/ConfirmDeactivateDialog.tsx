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

interface ConfirmDeactivateDialogProps {
  open: boolean;
  name: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeactivateDialog({
  open,
  name,
  loading = false,
  onConfirm,
  onCancel
}: ConfirmDeactivateDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Ignore Escape / outside dismissals while the request is in flight so
        // the dialog does not vanish mid-mutation.
        if (!next && !loading) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">Deactivate {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They will be immediately signed out and lose access. You can reactivate at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Radix closes the dialog on Action click by default; keep it open
              // until the parent resolves the mutation so the pending state is
              // visible and a failed request does not silently dismiss the dialog.
              event.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {loading ? 'Deactivating...' : 'Deactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
