import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required')
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  const successMessage = (location.state as { message?: string } | null)?.message ?? null;
  const { mutate: login, isPending, error } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const errorMessage = (() => {
    if (!error) return null;
    if (axios.isAxiosError(error)) {
      return (error.response?.data as { message?: string })?.message ?? 'Login failed';
    }
    return 'Login failed';
  })();

  const onSubmit = handleSubmit((values) => login(values));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Sign in</h1>

      {successMessage && !errorMessage && (
        <div role="status" className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-foreground">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-foreground">Password</label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              placeholder="••••••••"
              {...register('password')}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-foreground hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}

