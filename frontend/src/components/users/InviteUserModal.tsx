import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useInviteUser } from '@/hooks/useUsers';

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().trim().email(),
  role: z.enum(['manager', 'staff', 'viewer'])
});

type FormValues = z.infer<typeof schema>;

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
}

const roleDescriptions: Record<FormValues['role'], string> = {
  manager: 'Can manage products, stock, warehouses, and view reports',
  staff: 'Can view and adjust stock, acknowledge alerts',
  viewer: 'Read-only access to products and stock'
};

export function InviteUserModal({ open, onClose }: InviteUserModalProps) {
  const [error, setError] = useState<string | null>(null);
  const inviteMutation = useInviteUser();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'staff' }
  });

  const selectedRole = watch('role');

  // Reset form + error state on every close so a cancelled invite doesn't
  // reappear the next time the modal is opened.
  const handleClose = () => {
    setError(null);
    reset({ role: 'staff' });
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await inviteMutation.mutateAsync(values);
      handleClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('This email is already registered');
        return;
      }
      setError((err as { message?: string })?.message ?? 'Failed to send invitation');
    }
  });

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-user-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 id="invite-user-title" className="text-lg font-semibold text-foreground">Invite member</h2>
        <p className="mt-1 text-sm text-muted-foreground">Invite a teammate to your workspace.</p>

        {error ? <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div> : null}

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label htmlFor="invite-name" className="mb-1 block text-sm font-medium text-foreground">Name</label>
            <input
              id="invite-name"
              autoComplete="off"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Jordan Lee"
              {...register('name')}
            />
            {errors.name ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p> : null}
          </div>

          <div>
            <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-foreground">Email</label>
            <input
              id="invite-email"
              inputMode="email"
              autoComplete="off"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="jordan@example.com"
              {...register('email')}
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email.message}</p> : null}
          </div>

          <div>
            <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-foreground">Role</label>
            <select id="invite-role" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" {...register('role')}>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">{roleDescriptions[selectedRole]}</p>
            {errors.role ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.role.message}</p> : null}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={inviteMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : 'Send invitation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
