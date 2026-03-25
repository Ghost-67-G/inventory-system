import type { PropsWithChildren } from 'react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps extends PropsWithChildren {
  open: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, onConfirm, onCancel, children }: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-slate-600">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}
