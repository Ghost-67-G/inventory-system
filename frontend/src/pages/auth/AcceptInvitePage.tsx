import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
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
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

type FormValues = z.infer<typeof schema>;

function getPasswordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [status, setStatus] = useState<'verifying' | 'ready' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const passwordValue = watch('password') ?? '';
  const passwordScore = useMemo(() => getPasswordScore(passwordValue), [passwordValue]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This invite link has expired or already been used');
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('ready');
      })
      .catch(() => {
        setStatus('error');
        setError('This invite link has expired or already been used');
      });
  }, [token]);

  const onSubmit = handleSubmit(async (values) => {
    setIsLoading(true);
    setError(null);

    try {
      await authApi.resetPassword(token, values.password);
      void navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError((err.response?.data as { message?: string } | undefined)?.message ?? 'Failed to set password');
      } else {
        setError('Failed to set password');
      }
    } finally {
      setIsLoading(false);
    }
  });

  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
        <p className="text-sm text-muted-foreground">Verifying invite link...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Invite invalid</h1>
        <p className="mt-2 text-sm text-red-600">{error}</p>
        <Link className="mt-4 inline-block text-sm text-muted-foreground underline" to="/login">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-foreground">Set your password</h1>
      <p className="mb-5 text-sm text-muted-foreground">Finish setting up your invited account.</p>

      {error ? <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div> : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              placeholder="Create a strong password"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className={`h-2 rounded-full transition-all ${
                passwordScore <= 2 ? 'bg-red-500' : passwordScore <= 3 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${(passwordScore / 5) * 100}%` }}
            />
          </div>
          {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Confirm password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            placeholder="Re-enter your password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword ? <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p> : null}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Set password and sign in'}
        </Button>
      </form>
    </div>
  );
}
