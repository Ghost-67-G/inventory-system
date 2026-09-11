import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  // Re-sync on open so a cancelled edit doesn't leave a dirty name behind.
  useEffect(() => {
    if (!open) return;
    reset({ name: user?.name ?? '' });
  }, [open, user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync(values);
      onClose();
    } catch {
      // error toast is handled by the mutation hook; keep the modal open
    }
  });

  if (!user) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label htmlFor="edit-profile-name" className="mb-1 block text-sm font-medium text-foreground">Name</label>
            <input id="edit-profile-name" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" {...register('name')} />
            {errors.name ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p> : null}
          </div>

          <div>
            <label htmlFor="edit-profile-email" className="mb-1 block text-sm font-medium text-foreground">Email</label>
            <input
              id="edit-profile-email"
              className="w-full cursor-not-allowed rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
              value={user.email}
              disabled
              readOnly
            />
            <p className="mt-1 text-xs text-muted-foreground">Contact support to change email</p>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={updateProfile.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
