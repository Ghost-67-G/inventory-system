import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUpdateCustomField } from '@/hooks/useSettings';
import type { ICustomField, UpdateCustomFieldDto } from '@/types';

const schema = z.object({
  name: z.string().min(2).max(50).trim(),
  required: z.boolean(),
  defaultValue: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditCustomFieldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: ICustomField | null;
}

export function EditCustomFieldModal({ open, onOpenChange, field }: EditCustomFieldModalProps) {
  const { mutateAsync, isPending } = useUpdateCustomField();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', required: false, defaultValue: '' },
  });

  // Re-sync whenever the modal opens or the target field changes so a cancelled
  // edit doesn't leak stale values into the next session.
  useEffect(() => {
    if (!field || !open) return;
    form.reset({
      name: field.name,
      required: field.required,
      defaultValue: field.defaultValue ?? '',
    });
  }, [field, open, form]);

  async function onSubmit(values: FormValues) {
    if (!field) return;
    const dto: UpdateCustomFieldDto = {
      name: values.name,
      required: values.required,
      defaultValue: values.defaultValue || undefined,
    };
    try {
      await mutateAsync({ fieldId: field._id, data: dto });
      onOpenChange(false);
    } catch {
      // error toast is handled by the mutation hook; keep the modal open
    }
  }

  function handleClose() {
    onOpenChange(false);
  }

  if (!field) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Covers Cancel, the X button, Escape and overlay clicks. Closing is
        // blocked while a request is in flight.
        if (!next) {
          if (isPending) return;
          handleClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit field</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="edit-custom-field-name" className="mb-1.5 block text-sm font-medium text-foreground">Field name</label>
              <input
                id="edit-custom-field-name"
                {...form.register('name')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-custom-field-key" className="mb-1.5 block text-sm font-medium text-foreground">Field key</label>
              <input
                id="edit-custom-field-key"
                value={field.key}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-input bg-muted px-3 py-2 font-mono text-sm text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The field key cannot be changed after creation. Existing product data uses this key.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Type</label>
              <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-foreground">
                {field.type}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Required field</div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" aria-label="Required field" {...form.register('required')} className="peer sr-only" />
                <div className="peer h-5 w-9 rounded-full bg-muted-foreground/40 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-4" />
              </label>
            </div>

            {(field.type === 'text' || field.type === 'number') && (
              <div>
                <label htmlFor="edit-custom-field-default" className="mb-1.5 block text-sm font-medium text-foreground">
                  Default value <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="edit-custom-field-default"
                  {...form.register('defaultValue')}
                  type={field.type === 'number' ? 'number' : 'text'}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            )}

            <DialogFooter className="gap-2 pt-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
