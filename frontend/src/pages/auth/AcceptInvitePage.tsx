import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';
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

  // The invite token is consumed by the accept request itself, so the form is
  // shown straight away instead of "pre-verifying" (which used up the token and
  // made a page reload look like an expired invite).
  const [status, setStatus] = useState<'ready' | 'error'>(token ? 'ready' : 'error');
  const [error, setError] = useState<string | null>(
    token ? null : 'This invite link is missing its token. Please use the link from your email.'
  );
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

  const onSubmit = handleSubmit(async (values) => {
    setIsLoading(true);
    setError(null);

    try {
      await authApi.acceptInvite(token, values.password);
      // No session is issued by this endpoint, so a protected route would
      // bounce straight back to /login. Land on /login with a success note.
      void navigate('/login', { state: { message: 'Your password is set. Please sign in.' } });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const message = (err.response?.data as { message?: string } | undefined)?.message;
        if (err.response?.status === 400) {
          setStatus('error');
          setError(message ?? 'This invite link has expired or already been used');
        } else {
          setError(message ?? 'Failed to set password');
        }
      } else {
        setError('Failed to set password');
      }
    } finally {
      setIsLoading(false);
    }
  });

  if (status === 'error') {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Invite invalid</h1>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
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
          <label htmlFor="invite-password" className="mb-1 block text-sm font-medium text-foreground">Password</label>
          <div className="relative">
            <input
              id="invite-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              placeholder="Create a strong password"
              {...register('password')}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
          <label htmlFor="invite-confirm-password" className="mb-1 block text-sm font-medium text-foreground">Confirm password</label>
          <input
            id="invite-confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
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
