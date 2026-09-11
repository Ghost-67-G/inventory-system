import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateCategory, useUpdateCategory } from '@/hooks/useCategories';
import type { ICategory } from '@/types';

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid hex color (e.g. #6366f1)');

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  color: hexColorSchema,
  isActive: z.boolean().optional()
});

type FormValues = z.infer<typeof schema>;

const PRESET_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#f97316',
  '#84cc16',
  '#64748b'
] as const;

interface CategoryFormModalProps {
  mode: 'create' | 'edit';
  category?: ICategory;
  open: boolean;
  onClose: () => void;
}

export function CategoryFormModal({ mode, category, open, onClose }: CategoryFormModalProps) {
  const [nameError, setNameError] = useState<string | null>(null);
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      color: '#6366f1',
      isActive: true
    }
  });

  // Pre-fill edit mode / reset on open
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && category) {
        reset({
          name: category.name,
          description: category.description ?? '',
          color: category.color ?? '#6366f1',
          isActive: category.isActive
        });
      } else {
        reset({ name: '', description: '', color: '#6366f1', isActive: true });
      }
      setNameError(null);
    }
  }, [category, open, mode, reset]);

  const selectedColor = watch('color');
  const descriptionValue = watch('description') ?? '';
  const isActiveValue = watch('isActive');

  const onSubmit = handleSubmit(async (values) => {
    setNameError(null);
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(values);
      } else if (category) {
        await updateMutation.mutateAsync({ id: category._id, data: values });
      }
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        if (status === 409) {
          setNameError(message ?? 'A category with this name already exists');
          return;
        }
      }
      // non-409 errors are toasted by the mutation hook
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Covers Cancel, the X button, Escape and overlay clicks. Closing is
        // blocked while a request is in flight.
        if (!next) {
          if (isPending) return;
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add category' : 'Edit category'}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {/* Name */}
          <div>
            <label htmlFor="category-name" className="mb-1 block text-sm font-medium text-foreground">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="category-name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
              placeholder="e.g. Electronics, Raw Materials, Packaging"
              {...register('name')}
            />
            {errors.name ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>
            ) : null}
            {nameError ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{nameError}</p> : null}
          </div>

          {/* Color */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('color', color, { shouldDirty: true, shouldValidate: true })}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: color,
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0,
                    boxShadow:
                      selectedColor?.toLowerCase() === color
                        ? `0 0 0 2px var(--card), 0 0 0 4px ${color}`
                        : 'none'
                  }}
                  aria-label={`Select color ${color}`}
                  aria-pressed={selectedColor?.toLowerCase() === color}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">#</span>
              <input
                aria-label="Hex color"
                className="w-28 rounded-md border border-input bg-background px-2 py-1 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
                maxLength={6}
                placeholder="6366f1"
                spellCheck={false}
                value={(selectedColor ?? '').replace(/^#/, '')}
                onChange={(e) => {
                  // The visible "#" prefix lives outside the input; store the canonical "#rrggbb".
                  const raw = e.target.value.replace(/^#/, '').trim();
                  setValue('color', `#${raw}`, { shouldDirty: true, shouldValidate: Boolean(errors.color) });
                }}
              />
            </div>
            {errors.color ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.color.message}</p>
            ) : null}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="category-description" className="mb-1 block text-sm font-medium text-foreground">
              Description <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="category-description"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
              rows={3}
              maxLength={500}
              {...register('description')}
            />
            <div className="mt-0.5 flex justify-end">
              <span className="text-xs text-muted-foreground">{descriptionValue.length}/500</span>
            </div>
            {errors.description ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.description.message}</p>
            ) : null}
          </div>

          {/* isActive switch — edit mode only */}
          {mode === 'edit' ? (
            <div>
              <div className="flex items-center gap-3">
                <button
                  id="category-active"
                  type="button"
                  role="switch"
                  aria-checked={Boolean(isActiveValue)}
                  onClick={() => setValue('isActive', !isActiveValue)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50 ${
                    isActiveValue ? 'bg-primary' : 'bg-muted-foreground/40'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      isActiveValue ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
                <label htmlFor="category-active" className="cursor-pointer text-sm font-medium text-foreground">Active</label>
              </div>
              {!isActiveValue ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Inactive categories won&apos;t appear in product forms
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Footer */}
          <DialogFooter className="gap-2 pt-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {mode === 'create'
                ? isPending
                  ? 'Creating...'
                  : 'Create category'
                : isPending
                  ? 'Saving...'
                  : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
