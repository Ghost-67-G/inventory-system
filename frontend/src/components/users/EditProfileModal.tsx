import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useUpdateMyProfile } from '@/hooks/useUsers';
import type { SafeUser } from '@/types';

const schema = z.object({
  name: z.string().min(2).max(100)
});

type FormValues = z.infer<typeof schema>;

interface EditProfileModalProps {
  open: boolean;
  user: SafeUser | null;
  onClose: () => void;
}

export function EditProfileModal({ open, user, onClose }: EditProfileModalProps) {
  const updateProfile = useUpdateMyProfile();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '' }
  });

  useEffect(() => {
    reset({ name: user?.name ?? '' });
  }, [user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await updateProfile.mutateAsync(values);
    onClose();
  });

  if (!open || !user) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Edit profile</h2>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('name')} />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              className="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              value={user.email}
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-slate-500">Contact support to change email</p>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
