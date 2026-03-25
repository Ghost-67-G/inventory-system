import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import axios from 'axios';
import { authApi } from '@/api/endpoints/auth';
import { Button } from '@/components/ui/button';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Za-z]/, 'Must contain a letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      void navigate('/login', { state: { message: 'Password reset successfully. Please sign in.' } });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError((err.response?.data as { message?: string })?.message ?? 'Reset failed.');
      } else {
        setError('Reset failed.');
      }
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Set new password</h1>
      <p className="mb-6 text-sm text-slate-600">Choose a strong password for your account.</p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="••••••••"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            placeholder="••••••••"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </div>
  );
}
