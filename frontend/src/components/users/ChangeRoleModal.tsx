import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
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

  // Clear any stale API error when the modal is dismissed (Cancel / X / Escape / overlay).
  const handleClose = () => {
    setError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!user) {
      return;
    }

    setError(null);
    try {
      const data: UpdateUserDto = { role: values.role };
      await updateUser.mutateAsync({ userId: user._id, data });
      reset({ role: values.role });
      handleClose();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Failed to update role');
    }
  });

  if (!user) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>Update access level for {user.name}.</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
          Current role: <span className="font-semibold capitalize">{user.role}</span>
        </div>

        {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div> : null}

        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label htmlFor="change-role-select" className="mb-1 block text-sm font-medium text-foreground">Role</label>
            <select id="change-role-select" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" {...register('role')}>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
            {errors.role ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.role.message}</p> : null}
          </div>

          {isDowngrade ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
              This will remove {user.name}'s ability to manage products and view reports.
            </div>
          ) : null}

          <DialogFooter className="mt-4 gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={updateUser.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
