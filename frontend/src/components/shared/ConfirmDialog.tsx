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
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <div className="mt-2 text-sm text-muted-foreground">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}
