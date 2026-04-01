import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useInviteUser } from '@/hooks/useUsers';

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
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

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await inviteMutation.mutateAsync(values);
      onClose();
      reset({ role: 'staff' });
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Invite member</h2>
        <p className="mt-1 text-sm text-muted-foreground">Invite a teammate to your workspace.</p>

        {error ? <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div> : null}

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Jordan Lee"
              {...register('name')}
            />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="jordan@example.com"
              {...register('email')}
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Role</label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" {...register('role')}>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">{roleDescriptions[selectedRole]}</p>
            {errors.role ? <p className="mt-1 text-xs text-red-600">{errors.role.message}</p> : null}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
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
