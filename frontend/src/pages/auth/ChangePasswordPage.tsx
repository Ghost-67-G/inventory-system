import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import axios from 'axios';
import { authApi } from '@/api/endpoints/auth';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/useAuth';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Za-z]/, 'Must contain a letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordPage() {
  const { mutate: logoutMutate } = useLogout();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setSuccess(true);
      // Auto-logout after 2 seconds — all sessions invalidated
      setTimeout(() => logoutMutate(), 2000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError((err.response?.data as { message?: string })?.message ?? 'Failed to change password.');
      } else {
        setError('Failed to change password.');
      }
    } finally {
      setIsLoading(false);
    }
  });

  if (success) {
    return (
      <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
        Password changed successfully. Signing you out in 2 seconds…
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h2 className="mb-6 text-xl font-semibold text-foreground">Change password</h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Current password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              autoComplete="current-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground focus:border-ring focus:outline-none"
              {...register('currentPassword')}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowCurrent((v) => !v)}
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.currentPassword && <p className="mt-1 text-xs text-red-600">{errors.currentPassword.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">New password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground focus:border-ring focus:outline-none"
              {...register('newPassword')}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowNew((v) => !v)}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.newPassword && <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Confirm new password</label>
          <input
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </div>
  );
}
