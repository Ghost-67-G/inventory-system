import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAddCustomField } from '@/hooks/useSettings';
import type { AddCustomFieldDto, CustomFieldType } from '@/types';

const schema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50)
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9 _-]*$/, 'Must start with a letter'),
  type: z.enum(['text', 'number', 'boolean', 'date'] as const),
  required: z.boolean(),
  defaultValue: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

function generateKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const TYPE_DESCRIPTIONS: Record<CustomFieldType, string> = {
  text: 'Short text, URLs, codes',
  number: 'Quantities, prices, measurements',
  boolean: 'Yes/No checkbox',
  date: 'Date picker',
};

interface AddCustomFieldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCustomFieldModal({ open, onOpenChange }: AddCustomFieldModalProps) {
  const { mutateAsync, isPending } = useAddCustomField();
  const [previewKey, setPreviewKey] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: 'text', required: false, defaultValue: '' },
  });

  const watchedName = form.watch('name');
  const watchedType = form.watch('type');

  useEffect(() => {
    setPreviewKey(generateKey(watchedName));
  }, [watchedName]);

  async function onSubmit(values: FormValues) {
    const dto: AddCustomFieldDto = {
      name: values.name,
      type: values.type,
      required: values.required,
      defaultValue: values.defaultValue || undefined,
    };
    try {
      await mutateAsync(dto);
      form.reset();
      onOpenChange(false);
    } catch {
      // error toast is handled by the mutation hook; keep the modal open
    }
  }

  function handleClose() {
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Runs for Cancel, the X button, Escape and overlay clicks alike so the
        // form is always reset. Closing is blocked while a request is in flight.
        if (!next) {
          if (isPending) return;
          handleClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add custom field</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Field name */}
            <div>
              <label htmlFor="custom-field-name" className="mb-1.5 block text-sm font-medium text-foreground">
                Field name
              </label>
              <input
                id="custom-field-name"
                {...form.register('name')}
                placeholder="e.g. Batch Number, Expiry Date, Supplier Code"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              {previewKey && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Field key: <span className="font-mono text-foreground">{previewKey}</span>
                </p>
              )}
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Field type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Field type</label>
              <div className="space-y-2">
                {(['text', 'number', 'boolean', 'date'] as const).map((type) => (
                  <label key={type} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/50 has-checked:border-blue-500 has-checked:bg-blue-50 dark:has-checked:bg-blue-900/20">
                    <input
                      type="radio"
                      value={type}
                      {...form.register('type')}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <div className="text-sm font-medium capitalize text-foreground">{type}</div>
                      <div className="text-xs text-muted-foreground">{TYPE_DESCRIPTIONS[type]}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Required toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Required field</div>
                <div className="text-xs text-muted-foreground">Products cannot be saved without this field</div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" aria-label="Required field" {...form.register('required')} className="peer sr-only" />
                <div className="peer h-5 w-9 rounded-full bg-muted-foreground/40 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-4" />
              </label>
            </div>

            {/* Default value — only for text and number */}
            {(watchedType === 'text' || watchedType === 'number') && (
              <div>
                <label htmlFor="custom-field-default" className="mb-1.5 block text-sm font-medium text-foreground">
                  Default value <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="custom-field-default"
                  {...form.register('defaultValue')}
                  type={watchedType === 'number' ? 'number' : 'text'}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            )}

            <DialogFooter className="gap-2 pt-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Adding...' : 'Add field'}
              </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
