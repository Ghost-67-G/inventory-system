import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import type { IWarehouse, UpdateWarehouseDto } from '@/types';
import { useCreateWarehouse, useUpdateWarehouse } from '@/hooks/useWarehouses';

const warehouseFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Z0-9-]*$/, 'Uppercase letters, numbers, and dashes only')
    .optional()
    .or(z.literal('')),
  description: z.string().max(500).optional(),
  address: z
    .object({
      street: z.string().max(200).optional(),
      city: z.string().max(200).optional(),
      state: z.string().max(200).optional(),
      country: z.string().max(200).optional(),
      postalCode: z.string().max(200).optional()
    })
    .optional(),
  isDefault: z.boolean().optional()
});

type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

interface WarehouseFormModalProps {
  mode: 'create' | 'edit';
  warehouse?: IWarehouse;
  open: boolean;
  onClose: () => void;
}

function hasAddress(warehouse?: IWarehouse): boolean {
  return Boolean(warehouse) && Object.values(warehouse?.address || {}).some(Boolean);
}

function getDefaultValues(mode: 'create' | 'edit', warehouse?: IWarehouse): WarehouseFormValues {
  const isEdit = mode === 'edit' && Boolean(warehouse);
  return {
    name: isEdit && warehouse ? warehouse.name : '',
    code: isEdit && warehouse ? warehouse.code : '',
    description: isEdit && warehouse ? (warehouse.description ?? '') : '',
    address:
      isEdit && warehouse
        ? {
            street: warehouse.address?.street ?? '',
            city: warehouse.address?.city ?? '',
            state: warehouse.address?.state ?? '',
            country: warehouse.address?.country ?? '',
            postalCode: warehouse.address?.postalCode ?? ''
          }
        : { street: '', city: '', state: '', country: '', postalCode: '' },
    isDefault: isEdit && warehouse ? warehouse.isDefault : false
  };
}

export function WarehouseFormModal({ mode, warehouse, open, onClose }: WarehouseFormModalProps) {
  const [isAddressExpanded, setIsAddressExpanded] = useState(mode === 'edit' && hasAddress(warehouse));

  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: getDefaultValues(mode, warehouse)
  });
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors }
  } = form;

  // The modal stays mounted between opens (and switches between create/edit targets), so
  // `defaultValues` alone would keep showing the first-mounted values. Re-sync on every open.
  useEffect(() => {
    if (!open) return;
    reset(getDefaultValues(mode, warehouse));
    setIsAddressExpanded(mode === 'edit' && hasAddress(warehouse));
  }, [open, mode, warehouse, reset]);

  const codeField = register('code');

  async function onSubmit(values: WarehouseFormValues) {
    const payload = {
      name: values.name,
      code: values.code?.toUpperCase() || undefined,
      description: values.description || undefined,
      address: values.address,
      isDefault: values.isDefault
    };

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(payload);
      } else if (warehouse) {
        const updatePayload: UpdateWarehouseDto = {};
        if (payload.name) updatePayload.name = payload.name;
        if (payload.code) updatePayload.code = payload.code;
        if (payload.description !== undefined) updatePayload.description = payload.description;
        if (payload.address) updatePayload.address = payload.address;
        if (payload.isDefault !== undefined) updatePayload.isDefault = payload.isDefault;

        await updateMutation.mutateAsync({
          id: warehouse._id,
          data: updatePayload
        });
      }
      onClose();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        if (status === 409) {
          setError('code', { message: message ?? 'Warehouse code is already in use' });
        }
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add warehouse' : 'Edit warehouse'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new warehouse to store your products'
              : 'Update warehouse details'}
          </DialogDescription>
        </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Identity */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="warehouse-name" className="text-sm font-medium text-foreground">Name *</label>
                <Input id="warehouse-name" placeholder="e.g. Main Warehouse" {...register('name')} />
                {errors.name && <p className="text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="warehouse-code" className="text-sm font-medium text-foreground">Code</label>
                <Input
                  id="warehouse-code"
                  placeholder="e.g. WH-001, NORTH, MAIN"
                  autoCapitalize="characters"
                  {...codeField}
                  onBlur={(e) => {
                    // Keep react-hook-form's own blur bookkeeping, then normalise to uppercase.
                    void codeField.onBlur(e);
                    const value = e.currentTarget.value.toUpperCase();
                    setValue('code', value, { shouldValidate: true });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to auto-generate. Uppercase letters, numbers, and dashes only.
                </p>
                {errors.code && <p className="text-xs text-red-600 dark:text-red-400">{errors.code.message}</p>}
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="warehouse-is-default" className="cursor-pointer">
                    <p className="text-sm font-medium text-foreground">Default warehouse</p>
                    <p className="text-xs text-muted-foreground">Pre-selected when recording stock movements</p>
                  </label>
                  <input
                    id="warehouse-is-default"
                    type="checkbox"
                    className="h-4 w-4 shrink-0"
                    disabled={mode === 'edit' && warehouse?.isDefault}
                    {...register('isDefault')}
                  />
                </div>
              </div>
              {mode === 'edit' && warehouse?.isDefault && (
                <p className="text-xs text-muted-foreground">
                  To change default, set another warehouse as default first.
                </p>
              )}
            </div>

            {/* Section 2: Details */}
            <div className="space-y-1">
              <label htmlFor="warehouse-description" className="text-sm font-medium text-foreground">Description</label>
              <Textarea id="warehouse-description" placeholder="Add notes about this warehouse..." rows={3} {...register('description')} />
              {errors.description && <p className="text-xs text-red-600 dark:text-red-400">{errors.description.message}</p>}
            </div>

            {/* Section 3: Address (Collapsible) */}
            <div className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                className="gap-2 px-0"
                onClick={() => setIsAddressExpanded((prev) => !prev)}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isAddressExpanded ? 'rotate-180' : ''}`}
                />
                Add address (optional)
              </Button>

              {isAddressExpanded && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="warehouse-street" className="text-sm font-medium text-foreground">Street</label>
                    <Input id="warehouse-street" placeholder="123 Main St" {...register('address.street')} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="warehouse-city" className="text-sm font-medium text-foreground">City</label>
                      <Input id="warehouse-city" placeholder="City" {...register('address.city')} />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="warehouse-state" className="text-sm font-medium text-foreground">State</label>
                      <Input id="warehouse-state" placeholder="State" {...register('address.state')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="warehouse-country" className="text-sm font-medium text-foreground">Country</label>
                      <Input id="warehouse-country" placeholder="Country" {...register('address.country')} />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="warehouse-postal" className="text-sm font-medium text-foreground">Postal code</label>
                      <Input id="warehouse-postal" placeholder="Postal code" {...register('address.postalCode')} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {mode === 'create'
                  ? isLoading
                    ? 'Creating...'
                    : 'Create warehouse'
                  : isLoading
                    ? 'Saving...'
                    : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
