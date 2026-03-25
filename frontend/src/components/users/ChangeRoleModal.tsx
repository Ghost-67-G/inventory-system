import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useUpdateUser } from '@/hooks/useUsers';
import type { SafeUser, UpdateUserDto } from '@/types';

const schema = z.object({
  role: z.enum(['manager', 'staff', 'viewer'])
});

type FormValues = z.infer<typeof schema>;

interface ChangeRoleModalProps {
  user: SafeUser | null;
  open: boolean;
  onClose: () => void;
}

export function ChangeRoleModal({ user, open, onClose }: ChangeRoleModalProps) {
  const [error, setError] = useState<string | null>(null);
  const updateUser = useUpdateUser();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      role: user && user.role !== 'owner' ? user.role : 'staff'
    }
  });

  const selectedRole = watch('role');

  const isDowngrade = useMemo(() => {
    if (!user || user.role === 'owner') {
      return false;
    }

    const rank = { manager: 3, staff: 2, viewer: 1 } as const;
    return rank[selectedRole] < rank[user.role as keyof typeof rank];
  }, [selectedRole, user]);

  const onSubmit = handleSubmit(async (values) => {
    if (!user) {
      return;
    }

    setError(null);
    try {
      const data: UpdateUserDto = { role: values.role };
      await updateUser.mutateAsync({ userId: user._id, data });
      onClose();
      reset({ role: values.role });
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Failed to update role');
    }
  });

  if (!open || !user) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Change role</h2>
        <p className="mt-1 text-sm text-slate-500">Update access level for {user.name}.</p>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Current role: <span className="font-semibold capitalize">{user.role}</span>
        </div>

        {error ? <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...register('role')}>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
            {errors.role ? <p className="mt-1 text-xs text-red-600">{errors.role.message}</p> : null}
          </div>

          {isDowngrade ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This will remove {user.name}'s ability to manage products and view reports.
            </div>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
