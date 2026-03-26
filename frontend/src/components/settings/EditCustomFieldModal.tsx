import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    if (!field) return;
    form.reset({
      name: field.name,
      required: field.required,
      defaultValue: field.defaultValue ?? '',
    });
  }, [field, form]);

  async function onSubmit(values: FormValues) {
    if (!field) return;
    const dto: UpdateCustomFieldDto = {
      name: values.name,
      required: values.required,
      defaultValue: values.defaultValue || undefined,
    };
    await mutateAsync({ fieldId: field._id, data: dto });
    onOpenChange(false);
  }

  if (!field) return null;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Edit field</h2>
          <button onClick={() => onOpenChange(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Field name</label>
              <input
                {...form.register('name')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Field key</label>
              <input
                value={field.key}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                The field key cannot be changed after creation. Existing product data uses this key.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
                {field.type}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-700">Required field</div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" {...form.register('required')} className="peer sr-only" />
                <div className="peer h-5 w-9 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-4" />
              </label>
            </div>

            {(field.type === 'text' || field.type === 'number') && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Default value <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  {...form.register('defaultValue')}
                  type={field.type === 'number' ? 'number' : 'text'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
        </form>
      </div>
    </div>
  );
}
