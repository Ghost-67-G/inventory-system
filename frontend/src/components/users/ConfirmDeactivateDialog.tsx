import { Button } from '@/components/ui/button';

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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Deactivate {name}?</h2>
        <p className="mt-2 text-sm text-slate-600">
          They will be immediately signed out and lose access. You can reactivate at any time.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" className="bg-red-600 hover:bg-red-700" disabled={loading} onClick={onConfirm}>
            {loading ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </div>
      </div>
    </div>
  );
}
