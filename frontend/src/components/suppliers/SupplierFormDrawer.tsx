import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateSupplier, useUpdateSupplier } from '@/hooks/useSuppliers';
import { SUPPORTED_CURRENCIES, type ISupplier } from '@/types';

const formSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    code: z.string().trim().max(20).optional(),
    website: z.string().trim().url().optional().or(z.literal('')),
    contactName: z.string().max(100).optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(30).optional(),
    street: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    postalCode: z.string().max(30).optional(),
    paymentTerms: z.enum(['immediate', 'net15', 'net30', 'net45', 'net60', 'custom']),
    paymentTermsDays: z.coerce.number().int().min(1).optional(),
    currency: z.string().min(3).max(10),
    leadTimeDays: z.coerce.number().int().min(0).max(365),
    minimumOrderValue: z.coerce.number().min(0),
    notes: z.string().max(2000).optional()
  })
  .superRefine((data, ctx) => {
    if (data.paymentTerms === 'custom' && !data.paymentTermsDays) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentTermsDays'], message: 'Payment days is required' });
    }
  });

type FormData = z.infer<typeof formSchema>;

interface SupplierFormDrawerProps {
  open: boolean;
  onClose: () => void;
  supplier?: ISupplier;
}

export function SupplierFormDrawer({ open, onClose, supplier }: SupplierFormDrawerProps) {
  const isEdit = Boolean(supplier);
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      code: '',
      website: '',
      contactName: '',
      email: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      paymentTerms: 'net30',
      paymentTermsDays: 30,
      currency: 'USD',
      leadTimeDays: 7,
      minimumOrderValue: 0,
      notes: ''
    }
  });

  useEffect(() => {
    if (!open) return;

    if (supplier) {
      reset({
        name: supplier.name,
        code: supplier.code,
        website: supplier.website,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        street: supplier.address.street,
        city: supplier.address.city,
        state: supplier.address.state,
        country: supplier.address.country,
        postalCode: supplier.address.postalCode,
        paymentTerms: supplier.paymentTerms,
        paymentTermsDays: supplier.paymentTermsDays,
        currency: supplier.currency,
        leadTimeDays: supplier.leadTimeDays,
        minimumOrderValue: supplier.minimumOrderValue,
        notes: supplier.notes
      });
    } else {
      reset();
    }
  }, [open, supplier, reset]);

  const onSubmit = async (values: FormData) => {
    try {
      const payload = {
        name: values.name,
        code: values.code || undefined,
        website: values.website || undefined,
        contactName: values.contactName || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: {
          street: values.street || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          country: values.country || undefined,
          postalCode: values.postalCode || undefined
        },
        paymentTerms: values.paymentTerms,
        paymentTermsDays: values.paymentTerms === 'custom' ? values.paymentTermsDays : undefined,
        currency: values.currency,
        leadTimeDays: values.leadTimeDays,
        minimumOrderValue: values.minimumOrderValue,
        notes: values.notes || undefined
      };

      if (supplier) {
        await updateMutation.mutateAsync({ id: supplier._id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      onClose();
    } catch (error: any) {
      if (error?.response?.status === 409) {
        setError('code', { type: 'manual', message: 'Code already exists' });
      }
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit supplier' : 'Add supplier'}</SheetTitle>
          <SheetDescription>{isEdit ? 'Update supplier information' : 'Create a new supplier'}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-6 pb-20">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Identity</h3>
            <div>
              <label className="text-sm">Supplier name *</label>
              <Input {...register('name')} />
              {errors.name ? <p className="mt-1 text-xs text-red-500">{errors.name.message}</p> : null}
            </div>
            <div>
              <label className="text-sm">Code</label>
              <Input
                {...register('code')}
                onBlur={(e) => setValue('code', e.target.value.trim().toUpperCase())}
                placeholder="Auto-generated if empty"
              />
              {errors.code ? <p className="mt-1 text-xs text-red-500">{errors.code.message}</p> : null}
            </div>
            <div>
              <label className="text-sm">Website</label>
              <Input {...register('website')} placeholder="https://" />
              {errors.website ? <p className="mt-1 text-xs text-red-500">{errors.website.message}</p> : null}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Contact</h3>
            <Input {...register('contactName')} placeholder="Contact name" />
            <Input {...register('email')} placeholder="Email" />
            <Input {...register('phone')} placeholder="Phone" />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Address</h3>
            <Input {...register('street')} placeholder="Street" />
            <div className="grid grid-cols-2 gap-2">
              <Input {...register('city')} placeholder="City" />
              <Input {...register('state')} placeholder="State" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input {...register('country')} placeholder="Country" />
              <Input {...register('postalCode')} placeholder="Postal code" />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Commercial terms</h3>
            <select
              {...register('paymentTerms')}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="immediate">Immediate</option>
              <option value="net15">Net 15</option>
              <option value="net30">Net 30</option>
              <option value="net45">Net 45</option>
              <option value="net60">Net 60</option>
              <option value="custom">Custom</option>
            </select>
            {watch('paymentTerms') === 'custom' ? <Input type="number" {...register('paymentTermsDays')} placeholder="Payment days" /> : null}
            <select
              {...register('currency')}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {SUPPORTED_CURRENCIES.slice(0, 10).map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </select>
            <Input type="number" {...register('leadTimeDays')} placeholder="Lead time days" />
            <Input type="number" step="0.01" {...register('minimumOrderValue')} placeholder="Minimum order value" />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Notes</h3>
            <Textarea rows={4} {...register('notes')} />
          </section>

          <div className="fixed bottom-0 left-0 right-0 flex justify-end gap-2 border-t border-border bg-background p-4 sm:absolute">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isEdit ? 'Save changes' : 'Create supplier'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
