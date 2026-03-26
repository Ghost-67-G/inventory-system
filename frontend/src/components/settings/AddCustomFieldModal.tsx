import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    await mutateAsync(dto);
    form.reset();
    onOpenChange(false);
  }

  function handleClose() {
    form.reset();
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add custom field</h2>
          <button onClick={handleClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Field name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Field name
              </label>
              <input
                {...form.register('name')}
                placeholder="e.g. Batch Number, Expiry Date, Supplier Code"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              {previewKey && (
                <p className="mt-1 text-xs text-slate-400">
                  Field key: <span className="font-mono text-slate-600">{previewKey}</span>
                </p>
              )}
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Field type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Field type</label>
              <div className="space-y-2">
                {(['text', 'number', 'boolean', 'date'] as const).map((type) => (
                  <label key={type} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                    <input
                      type="radio"
                      value={type}
                      {...form.register('type')}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <div className="text-sm font-medium capitalize text-slate-800">{type}</div>
                      <div className="text-xs text-slate-500">{TYPE_DESCRIPTIONS[type]}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Required toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-700">Required field</div>
                <div className="text-xs text-slate-500">Products cannot be saved without this field</div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" {...form.register('required')} className="peer sr-only" />
                <div className="peer h-5 w-9 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-4" />
              </label>
            </div>

            {/* Default value — only for text and number */}
            {(watchedType === 'text' || watchedType === 'number') && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Default value <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  {...form.register('defaultValue')}
                  type={watchedType === 'number' ? 'number' : 'text'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Adding...' : 'Add field'}
              </Button>
            </div>
        </form>
      </div>
    </div>
  );
}
